#!/usr/bin/env node
// FabReceipt — ABI discovery step 4: market listing structure (raw decode),
// CPU circuit-id semantics (ownerOf at boundaries), factory bem().
// Read-only. Usage: node scanner/probe-market.js
'use strict';
const { ethers } = require('ethers');
const config = require('../config');

async function raw(provider, to, data, block) {
  try { return await provider.call({ to, data }, block); }
  catch (e) { return 'REVERT: ' + (e.data || e.shortMessage || e.message || '').toString().slice(0, 100); }
}
function words(hex) {
  if (!hex || hex === '0x' || hex.startsWith('REVERT')) return hex;
  const out = [];
  for (let i = 2; i + 64 <= hex.length; i += 64) out.push('0x' + hex.slice(i, i + 64));
  return out.join('\n    ');
}

async function main() {
  const provider = new ethers.JsonRpcProvider(config.chains.mainnet.rpc);
  const block = await provider.getBlockNumber();
  console.log(`block: ${block}`);
  const M = config.tapeout.market, F = config.tapeout.factory;
  const cpu0 = '0x839bdD6fa7A66416A609A735e11DE5411B98574e';

  console.log('\nfactory.bem() 0x8765cf7b:', await raw(provider, F, '0x8765cf7b', block));
  console.log('market.listings(0) raw:\n   ', words(await raw(provider, M, '0xde74e57b' + '0'.repeat(64), block)));
  console.log('market.listingView(0) raw:\n   ', words(await raw(provider, M, '0xbeab7067' + '0'.repeat(64), block)));
  const cpuPadded = '0'.repeat(24) + cpu0.slice(2).toLowerCase();
  console.log('market.listingOf(cpu0, 0) raw:\n   ', words(await raw(provider, M, '0x216f2f24' + cpuPadded + '0'.repeat(64), block)));
  console.log('market.listingOf(cpu0, 1) raw:\n   ', words(await raw(provider, M, '0x216f2f24' + cpuPadded + '0'.repeat(63) + '1', block)));

  // CPU circuit id semantics: ownerOf at 0, 1, nextId-1=104, nextId=105.
  const ownerOf = (id) => '0x6352211e' + id.toString(16).padStart(64, '0');
  for (const id of [0, 1, 104, 105]) {
    console.log(`cpu0.ownerOf(${id}):`, await raw(provider, cpu0, ownerOf(id), block));
  }
  console.log('cpu0.circuitInfo(1) raw:\n   ', words(await raw(provider, cpu0, '0x084d60f1' + '1'.padStart(64, '0'), block)));
}
main().catch((e) => { console.error('FAILED:', e.message || e); process.exit(1); });
