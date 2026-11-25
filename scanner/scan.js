#!/usr/bin/env node
// FabReceipt scanner — Phase A (proxy/integrity level, no ABI needed).
// Read-only: reads X Layer mainnet block height, code sizes and EIP-1967 slots for the
// TapeOut factory and market, and writes a block-pinned JSON snapshot to ../data/.
// Phase B (build phase) adds factory ABI discovery + the full processor census.
//
// Usage: node scanner/scan.js [outFile]
'use strict';

const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');
const config = require('../config');

function slotToAddress(v) {
  if (!v || v === '0x' || /^0x0*$/.test(v)) return null;
  return ethers.getAddress('0x' + v.slice(-40));
}

async function probe(provider, label, address) {
  const code = await provider.getCode(address);
  const impl = slotToAddress(await provider.getStorage(address, config.slots.implementation));
  const admin = slotToAddress(await provider.getStorage(address, config.slots.admin));
  const beacon = slotToAddress(await provider.getStorage(address, config.slots.beacon));
  const out = {
    label,
    address,
    codeBytes: (code.length - 2) / 2,
    implementation: impl,
    admin,
    beacon,
  };
  if (impl) {
    const implCode = await provider.getCode(impl);
    out.implementationCodeBytes = (implCode.length - 2) / 2;
  }
  return out;
}

async function main() {
  const provider = new ethers.JsonRpcProvider(config.chains.mainnet.rpc);
  const net = await provider.getNetwork();
  if (Number(net.chainId) !== config.chains.mainnet.chainId) {
    throw new Error(`chainId mismatch: got ${net.chainId}, expected ${config.chains.mainnet.chainId}`);
  }
  const block = await provider.getBlockNumber();
  const snapshot = {
    tool: 'FabReceipt scanner (phase A)',
    chain: config.chains.mainnet.name,
    chainId: Number(net.chainId),
    block,
    takenAt: new Date().toISOString(),
    contracts: [
      await probe(provider, 'TapeOut CPU factory', config.tapeout.factory),
      await probe(provider, 'TapeOut market', config.tapeout.market),
    ],
  };
  const outFile = process.argv[2] || path.join(__dirname, '..', 'data', `snapshot-${block}.json`);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(snapshot, null, 2));
  fs.writeFileSync(path.join(__dirname, '..', 'data', 'snapshot-latest.json'), JSON.stringify(snapshot, null, 2));
  console.log(JSON.stringify(snapshot, null, 2));
  console.log(`\n[fabreceipt] snapshot written: ${outFile}`);
}

main().catch((e) => { console.error('[fabreceipt] FAILED:', e.message || e); process.exit(1); });
