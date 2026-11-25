#!/usr/bin/env node
// FabReceipt — ABI discovery step 3: probe one CPU (processor) + its transistor
// contract with the resolved signatures, and raw-probe the CPU implementation's
// still-unresolved selectors to classify them (view vs error vs write).
// Read-only. Usage: node scanner/probe-cpu.js [cpuIndex]
'use strict';
const { ethers } = require('ethers');
const config = require('../config');

const FACTORY_ABI = ['function cpuAt(uint256) view returns (address)', 'function cpuCount() view returns (uint256)'];
const CPU_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function nextId() view returns (uint256)',
  'function transistors() view returns (address)',
  'function transistorsContract() view returns (address)',
  'function NAND() view returns (uint256)',
  'function LATCH() view returns (uint256)',
  'function TAPEOUT_FEE() view returns (uint256)',
  'function TREASURY() view returns (address)',
  'function tokenURI(uint256) view returns (string)',
];
const TRANSISTOR_ABI = [
  'function creator() view returns (address)',
  'function mintPrice() view returns (uint256)',
  'function minted() view returns (uint256)',
  'function supplyCap() view returns (uint256)',
  'function cpuName() view returns (string)',
  'function cpuSymbol() view returns (string)',
  'function story() view returns (string)',
  'function NAND() view returns (uint256)',
  'function LATCH() view returns (uint256)',
  'function protocolFee() view returns (uint256)',
  'function uri(uint256) view returns (string)',
  'function balanceOf(address,uint256) view returns (uint256)',
  'function totalSupply(uint256) view returns (uint256)',
];
const UNRESOLVED_CPU = ['0x0a85bd01', '0x0b611743', '0x22718ad9', '0x32505749', '0x39e35637',
  '0x52211e14', '0x5b5e139f', '0x74140d0d', '0x80ac58cd', '0x8cc20bc4', '0x90611c3a', '0xc4a11628', '0x6f646560'];

async function tryCall(label, fn) {
  try { const v = await fn(); console.log(`${label}: ${v}`); return v; }
  catch (e) { console.log(`${label}: REVERT/ERR ${(e.shortMessage || e.message || '').slice(0, 80)}`); return undefined; }
}

async function main() {
  const provider = new ethers.JsonRpcProvider(config.chains.mainnet.rpc);
  const block = await provider.getBlockNumber();
  const opt = { blockTag: block };
  console.log(`block: ${block}`);
  const factory = new ethers.Contract(config.tapeout.factory, FACTORY_ABI, provider);
  const idx = Number(process.argv[2] || 0);
  const cpuAddr = await factory.cpuAt(idx, opt);
  console.log(`CPU[${idx}] ${cpuAddr}`);
  const cpu = new ethers.Contract(cpuAddr, CPU_ABI, provider);
  await tryCall('cpu.name', () => cpu.name(opt));
  await tryCall('cpu.symbol', () => cpu.symbol(opt));
  const nextId = await tryCall('cpu.nextId', async () => (await cpu.nextId(opt)).toString());
  await tryCall('cpu.NAND', async () => (await cpu.NAND(opt)).toString());
  await tryCall('cpu.LATCH', async () => (await cpu.LATCH(opt)).toString());
  await tryCall('cpu.TAPEOUT_FEE', async () => (await cpu.TAPEOUT_FEE(opt)).toString());
  await tryCall('cpu.TREASURY', () => cpu.TREASURY(opt));
  await tryCall('cpu.tokenURI(0)', () => cpu.tokenURI(0, opt));
  if (nextId && Number(nextId) > 0) await tryCall(`cpu.tokenURI(${Number(nextId) - 1})`, () => cpu.tokenURI(Number(nextId) - 1, opt));
  const tAddr = await tryCall('cpu.transistors', () => cpu.transistors(opt));
  await tryCall('cpu.transistorsContract', () => cpu.transistorsContract(opt));

  // Raw-probe unresolved selectors on the CPU (no-arg and uint256(0) forms).
  console.log('\n-- unresolved CPU selectors, raw probes --');
  for (const sel of UNRESOLVED_CPU) {
    for (const args of ['', '0'.repeat(64)]) {
      try {
        const res = await provider.call({ to: cpuAddr, data: sel + args }, block);
        console.log(`${sel} args=${args ? 'uint256(0)' : 'none'} -> ${res.slice(0, 130)}${res.length > 130 ? '…' : ''} (${(res.length - 2) / 2} bytes)`);
        break;
      } catch { /* revert: try next form, else classify as non-view/error */ }
    }
  }

  if (tAddr) {
    const tCode = await provider.getCode(tAddr, block);
    const tBeacon = await provider.getStorage(tAddr, config.slots.beacon, block);
    console.log(`\ntransistors ${tAddr} codeBytes=${(tCode.length - 2) / 2} beaconSlot=${tBeacon}`);
    const tr = new ethers.Contract(tAddr, TRANSISTOR_ABI, provider);
    await tryCall('tr.creator', () => tr.creator(opt));
    await tryCall('tr.mintPrice', async () => `${(await tr.mintPrice(opt)).toString()} wei (${ethers.formatEther(await tr.mintPrice(opt))} OKB)`);
    await tryCall('tr.minted', async () => (await tr.minted(opt)).toString());
    await tryCall('tr.supplyCap', async () => (await tr.supplyCap(opt)).toString());
    await tryCall('tr.cpuName', () => tr.cpuName(opt));
    await tryCall('tr.cpuSymbol', () => tr.cpuSymbol(opt));
    await tryCall('tr.story', () => tr.story(opt));
    const nand = await tryCall('tr.NAND', async () => (await tr.NAND(opt)).toString());
    const latch = await tryCall('tr.LATCH', async () => (await tr.LATCH(opt)).toString());
    await tryCall('tr.protocolFee', async () => (await tr.protocolFee(opt)).toString());
    if (nand !== undefined) await tryCall(`tr.totalSupply(NAND=${nand})`, async () => (await tr.totalSupply(BigInt(nand), opt)).toString());
    if (latch !== undefined) await tryCall(`tr.totalSupply(LATCH=${latch})`, async () => (await tr.totalSupply(BigInt(latch), opt)).toString());
    await tryCall('tr.uri(0)', () => tr.uri(0, opt));
  }
}
main().catch((e) => { console.error('FAILED:', e.message || e); process.exit(1); });
