#!/usr/bin/env node
// FabReceipt — deploy ReceiptAnchor to X Layer TESTNET (chain 1952) and anchor
// the latest census snapshot hash. Testnet only: this script refuses mainnet.
//
// The deployer key lives in contracts/.env.testnet (generated locally, mode 600,
// never committed). Funding comes from the OKX X Layer testnet faucet, which is
// captcha-gated in a browser — a Karis step. If the wallet is unfunded this
// script prints the address + instructions and exits with code 2, spending
// nothing.
//
// Usage: node contracts/deploy-testnet.js [censusFile]
'use strict';

const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');
const config = require('../config');

function loadDeployer() {
  const envPath = path.join(__dirname, '.env.testnet');
  if (!fs.existsSync(envPath)) throw new Error('contracts/.env.testnet missing — generate the deployer wallet first');
  const env = {};
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  }
  if (!env.DEPLOYER_PRIVATE_KEY) throw new Error('.env.testnet has no DEPLOYER_PRIVATE_KEY');
  return env.DEPLOYER_PRIVATE_KEY;
}

function latestCensusFile() {
  const dir = path.join(__dirname, '..', 'data');
  const files = fs.readdirSync(dir).filter((f) => /^census-\d+\.json$/.test(f)).sort();
  if (!files.length) throw new Error('no census snapshot in data/ — run scanner/census.js first');
  return path.join(dir, files[files.length - 1]);
}

async function main() {
  const provider = new ethers.JsonRpcProvider(config.chains.testnet.rpc);
  const net = await provider.getNetwork();
  if (Number(net.chainId) !== config.chains.testnet.chainId) {
    throw new Error(`Refusing to run: RPC chainId is ${net.chainId}, expected ${config.chains.testnet.chainId} (X Layer testnet)`);
  }
  const wallet = new ethers.Wallet(loadDeployer(), provider);
  const balance = await provider.getBalance(wallet.address);
  console.log(`[anchor] deployer ${wallet.address} balance ${ethers.formatEther(balance)} OKB (testnet)`);
  if (balance < ethers.parseEther('0.01')) {
    console.log('\nFUNDING NEEDED (Karis step):');
    console.log(`  1. Open ${config.chains.testnet.faucet} in your browser (captcha-gated).`);
    console.log(`  2. Claim testnet OKB to: ${wallet.address}`);
    console.log('  3. Re-run: node contracts/deploy-testnet.js');
    process.exit(2);
  }

  const abi = JSON.parse(fs.readFileSync(path.join(__dirname, 'build', 'ReceiptAnchor.abi.json'), 'utf8'));
  const bin = fs.readFileSync(path.join(__dirname, 'build', 'ReceiptAnchor.bin'), 'utf8').trim();
  console.log('[anchor] deploying ReceiptAnchor…');
  const factory = new ethers.ContractFactory(abi, bin, wallet);
  const anchorContract = await factory.deploy();
  const deployTx = anchorContract.deploymentTransaction();
  await anchorContract.waitForDeployment();
  const address = await anchorContract.getAddress();
  console.log(`[anchor] ReceiptAnchor deployed: ${address} (tx ${deployTx.hash})`);

  const censusFile = process.argv[2] || latestCensusFile();
  const bytes = fs.readFileSync(censusFile);
  const snapshot = JSON.parse(bytes.toString('utf8'));
  const hash = ethers.keccak256(bytes);
  const uri = `FabReceipt census snapshot, X Layer mainnet block ${snapshot.block} (${path.basename(censusFile)})`;
  console.log(`[anchor] anchoring snapshot hash ${hash} for mainnet block ${snapshot.block}…`);
  const tx = await anchorContract.anchor(hash, snapshot.block, uri);
  await tx.wait();
  console.log(`[anchor] anchor tx: ${tx.hash}`);

  const count = await anchorContract.count();
  const [h, blk, at] = await anchorContract.get(0);
  const record = {
    network: config.chains.testnet.name, chainId: config.chains.testnet.chainId,
    receiptAnchor: address, deployTx: deployTx.hash, anchorTx: tx.hash,
    deployer: wallet.address,
    snapshotFile: path.basename(censusFile), snapshotBlock: snapshot.block, snapshotHash: hash,
    readBack: { count: Number(count), hash: h, xlayerBlock: Number(blk), anchoredAt: Number(at) },
    explorer: `${config.chains.testnet.explorer}/address/${address}`,
  };
  if (record.readBack.hash !== hash) throw new Error('read-back hash mismatch');
  const out = path.join(__dirname, '..', 'data', 'anchor-testnet.json');
  fs.writeFileSync(out, JSON.stringify(record, null, 2));
  console.log(`[anchor] verified on-chain. Record written: ${out}`);
  console.log(`[anchor] explorer: ${record.explorer}`);
}

main().catch((e) => { console.error('[anchor] FAILED:', e.message || e); process.exit(1); });
