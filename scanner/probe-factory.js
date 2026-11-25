#!/usr/bin/env node
// FabReceipt — ABI discovery step 2: probe the TapeOut factory + market with the
// signatures resolved from the signature database, and inspect the first CPUs
// (code size + EIP-1967 implementation/beacon slots). Read-only.
// Usage: node scanner/probe-factory.js
'use strict';
const { ethers } = require('ethers');
const config = require('../config');

const FACTORY_ABI = [
  'function cpuCount() view returns (uint256)',
  'function cpuAt(uint256) view returns (address)',
  'function cpus(uint256) view returns (address)',
  'function isCPU(address) view returns (bool)',
  'function deployFee() view returns (uint256)',
  'function protocolFee() view returns (uint256)',
  'function protocolWallet() view returns (address)',
  'function BEM() view returns (address)',
  'function transistorBeacon() view returns (address)',
  'function circuitBeacon() view returns (address)',
  'function owner() view returns (address)',
  'function isSealed() view returns (bool)',
  'function MAX_MINT_PRICE() view returns (uint256)',
  'function MAX_DEPLOY_FEE() view returns (uint256)',
];
const MARKET_ABI = [
  'function transistors() view returns (address)',
  'function circuits() view returns (address)',
  'function feeBps() view returns (uint256)',
  'function nextListingId() view returns (uint256)',
  'function owner() view returns (address)',
  'function isSealed() view returns (bool)',
  'function protocolWallet() view returns (address)',
];

function slotToAddress(v) {
  if (!v || v === '0x' || /^0x0*$/.test(v)) return null;
  return ethers.getAddress('0x' + v.slice(-40));
}

async function tryCall(label, fn) {
  try { console.log(`${label}: ${await fn()}`); }
  catch (e) { console.log(`${label}: REVERT/ERR ${e.shortMessage || e.message}`); }
}

async function main() {
  const provider = new ethers.JsonRpcProvider(config.chains.mainnet.rpc);
  const block = await provider.getBlockNumber();
  console.log(`block: ${block}`);
  const factory = new ethers.Contract(config.tapeout.factory, FACTORY_ABI, provider);
  const market = new ethers.Contract(config.tapeout.market, MARKET_ABI, provider);
  const opt = { blockTag: block };

  let count;
  await tryCall('factory.cpuCount', async () => { count = await factory.cpuCount(opt); return count.toString(); });
  await tryCall('factory.deployFee', async () => ethers.formatEther(await factory.deployFee(opt)));
  await tryCall('factory.protocolFee', async () => (await factory.protocolFee(opt)).toString());
  await tryCall('factory.protocolWallet', () => factory.protocolWallet(opt));
  await tryCall('factory.BEM', () => factory.BEM(opt));
  await tryCall('factory.transistorBeacon', () => factory.transistorBeacon(opt));
  await tryCall('factory.circuitBeacon', () => factory.circuitBeacon(opt));
  await tryCall('factory.owner', () => factory.owner(opt));
  await tryCall('factory.isSealed', () => factory.isSealed(opt));
  await tryCall('factory.MAX_MINT_PRICE', async () => (await factory.MAX_MINT_PRICE(opt)).toString());
  await tryCall('market.transistors', () => market.transistors(opt));
  await tryCall('market.circuits', () => market.circuits(opt));
  await tryCall('market.feeBps', async () => (await market.feeBps(opt)).toString());
  await tryCall('market.nextListingId', async () => (await market.nextListingId(opt)).toString());
  await tryCall('market.owner', () => market.owner(opt));
  await tryCall('market.isSealed', () => market.isSealed(opt));

  const n = count ? Number(count) : 0;
  for (const i of [0, 1, 2, n - 1]) {
    if (i < 0 || i >= n) continue;
    const addr = await factory.cpuAt(i, opt);
    const viaArray = await factory.cpus(i, opt).catch(() => null);
    const code = await provider.getCode(addr, block);
    const impl = slotToAddress(await provider.getStorage(addr, config.slots.implementation, block));
    const beacon = slotToAddress(await provider.getStorage(addr, config.slots.beacon, block));
    console.log(`\nCPU[${i}] ${addr} (cpus() match: ${viaArray === addr}) codeBytes=${(code.length - 2) / 2} impl=${impl} beacon=${beacon}`);
    if (beacon) {
      const bImpl = await new ethers.Contract(beacon, ['function implementation() view returns (address)'], provider)
        .implementation(opt).catch(() => null);
      console.log(`  beacon implementation(): ${bImpl}`);
    }
    await tryCall(`  factory.isCPU(CPU[${i}])`, () => factory.isCPU(addr, opt));
  }
}
main().catch((e) => { console.error('FAILED:', e.message || e); process.exit(1); });
