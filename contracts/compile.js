#!/usr/bin/env node
// Compile ReceiptAnchor.sol with the npm solc package into contracts/build/.
'use strict';
const fs = require('fs');
const path = require('path');
const solc = require('solc');

const src = fs.readFileSync(path.join(__dirname, 'ReceiptAnchor.sol'), 'utf8');
const input = {
  language: 'Solidity',
  sources: { 'ReceiptAnchor.sol': { content: src } },
  settings: { optimizer: { enabled: true, runs: 200 }, outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } } },
};
const out = JSON.parse(solc.compile(JSON.stringify(input)));
if (out.errors) {
  for (const e of out.errors) {
    if (e.severity === 'error') { console.error(e.formattedMessage); process.exit(1); }
  }
}
const c = out.contracts['ReceiptAnchor.sol'].ReceiptAnchor;
fs.mkdirSync(path.join(__dirname, 'build'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'build', 'ReceiptAnchor.abi.json'), JSON.stringify(c.abi, null, 2));
fs.writeFileSync(path.join(__dirname, 'build', 'ReceiptAnchor.bin'), c.evm.bytecode.object);
console.log(`[compile] ReceiptAnchor OK, bytecode bytes: ${c.evm.bytecode.object.length / 2}, solc ${solc.version()}`);
