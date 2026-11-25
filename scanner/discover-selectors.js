#!/usr/bin/env node
// FabReceipt — ABI discovery step 1: extract function selectors from a contract's
// runtime bytecode dispatcher (PUSH4 immediates) and report them.
// Read-only. Usage: node scanner/discover-selectors.js <address> [address...]
'use strict';
const { ethers } = require('ethers');
const config = require('../config');

async function main() {
  const provider = new ethers.JsonRpcProvider(config.chains.mainnet.rpc);
  for (const addr of process.argv.slice(2)) {
    const code = await provider.getCode(addr);
    const hex = code.slice(2);
    const sels = new Set();
    // Scan for PUSH4 (0x63) opcodes followed by 4 bytes; dispatcher compares dominate.
    for (let i = 0; i + 10 <= hex.length; i += 2) {
      if (hex.slice(i, i + 2) === '63') {
        sels.add('0x' + hex.slice(i + 2, i + 10));
      }
    }
    console.log(`\n== ${addr} (${(code.length - 2) / 2} bytes) — ${sels.size} PUSH4 candidates`);
    console.log([...sels].sort().join('\n'));
  }
}
main().catch((e) => { console.error('FAILED:', e.message || e); process.exit(1); });
