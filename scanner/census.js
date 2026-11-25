#!/usr/bin/env node
// FabReceipt census scanner — full TapeOut processor census at one pinned block.
//
// Read-only against X Layer mainnet (https://rpc.xlayer.tech). Enumerates every
// processor registered in the TapeOut CPU factory and reads, per processor:
//   identity  — address, name, symbol, creator, beacon + implementation, code size
//   economics — transistor mint price (wei/OKB), transistors minted, supply cap
//   production— circuits etched (the CPU's ERC-721 nextId; circuit ids are 1-based)
//
// RPC politeness: bulk eth_calls go through Multicall3 in chunks of 100 with a
// pause between chunks (one HTTP request per chunk). Storage/code reads are paced
// at low concurrency. Nothing is written on-chain; no wallet is involved.
//
// Usage: node scanner/census.js [outFile]
'use strict';

const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');
const config = require('../config');
const ABIS = require('./abi');

const CHUNK = 100;          // multicall calls per RPC request
const CHUNK_PAUSE_MS = 150; // pause between multicall requests
const IO_CONCURRENCY = 3;   // parallel storage/code reads (public RPC throttles hard)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The public X Layer RPC rate-limits bursts of eth_getStorageAt/eth_getCode, so
// these reads retry with backoff and alternate between the two public endpoints.
async function readWithRetry(fn, providers) {
  let lastErr;
  for (let attempt = 0; attempt < 5; attempt++) {
    try { return await fn(providers[attempt % providers.length]); }
    catch (e) { lastErr = e; await sleep(300 * 2 ** attempt); }
  }
  throw lastErr;
}

function slotToAddress(v) {
  if (!v || v === '0x' || /^0x0*$/.test(v)) return null;
  return ethers.getAddress('0x' + v.slice(-40));
}

async function pacedMap(items, fn) {
  const out = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: IO_CONCURRENCY }, worker));
  return out;
}

// Batch a list of {target, iface, fn, args} calls through Multicall3 (or direct
// calls if Multicall3 is unavailable). Returns decoded values or null per call.
async function batchCalls(provider, mc, calls, block) {
  const results = new Array(calls.length).fill(null);
  for (let start = 0; start < calls.length; start += CHUNK) {
    const slice = calls.slice(start, start + CHUNK);
    if (mc) {
      const payload = slice.map((c) => ({
        target: c.target,
        allowFailure: true,
        callData: c.iface.encodeFunctionData(c.fn, c.args),
      }));
      const res = await mc.aggregate3(payload, { blockTag: block });
      slice.forEach((c, j) => {
        const r = res[j];
        if (r.success && r.returnData !== '0x') {
          try { results[start + j] = c.iface.decodeFunctionResult(c.fn, r.returnData)[0]; } catch { /* keep null */ }
        }
      });
    } else {
      await pacedMap(slice, async (c, j) => {
        try {
          const raw = await provider.call({ to: c.target, data: c.iface.encodeFunctionData(c.fn, c.args) }, block);
          results[start + j] = c.iface.decodeFunctionResult(c.fn, raw)[0];
        } catch { /* keep null */ }
      });
    }
    if (start + CHUNK < calls.length) await sleep(CHUNK_PAUSE_MS);
  }
  return results;
}

async function probeProxy(provider, label, address, block) {
  const code = await provider.getCode(address, block);
  const impl = slotToAddress(await provider.getStorage(address, config.slots.implementation, block));
  const admin = slotToAddress(await provider.getStorage(address, config.slots.admin, block));
  const beacon = slotToAddress(await provider.getStorage(address, config.slots.beacon, block));
  const out = { label, address, codeBytes: (code.length - 2) / 2, implementation: impl, admin, beacon };
  if (impl) {
    try { out.implementationCodeBytes = ((await provider.getCode(impl, block)).length - 2) / 2; }
    catch { out.implementationCodeBytes = null; }
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
  console.log(`[census] pinned block ${block}`);

  const mcCode = await provider.getCode(ABIS.multicall3Address, block);
  const mc = mcCode.length > 2
    ? new ethers.Contract(ABIS.multicall3Address, ABIS.multicall3, provider)
    : null;
  console.log(`[census] Multicall3 ${mc ? 'available' : 'NOT available — paced direct calls'}`);

  const factoryIface = new ethers.Interface(ABIS.factory);
  const marketIface = new ethers.Interface(ABIS.market);
  const cpuIface = new ethers.Interface(ABIS.cpu);
  const trIface = new ethers.Interface(ABIS.transistor);
  const F = config.tapeout.factory, M = config.tapeout.market;

  // ---- protocol level (Phase A fields + globals) ---------------------------
  const factoryProbe = await probeProxy(provider, 'TapeOut CPU factory', F, block);
  const marketProbe = await probeProxy(provider, 'TapeOut market', M, block);
  const globals = await batchCalls(provider, mc, [
    { target: F, iface: factoryIface, fn: 'cpuCount', args: [] },
    { target: F, iface: factoryIface, fn: 'deployFee', args: [] },
    { target: F, iface: factoryIface, fn: 'protocolFee', args: [] },
    { target: F, iface: factoryIface, fn: 'protocolWallet', args: [] },
    { target: F, iface: factoryIface, fn: 'bem', args: [] },
    { target: F, iface: factoryIface, fn: 'transistorBeacon', args: [] },
    { target: F, iface: factoryIface, fn: 'circuitBeacon', args: [] },
    { target: F, iface: factoryIface, fn: 'owner', args: [] },
    { target: F, iface: factoryIface, fn: 'isSealed', args: [] },
    { target: M, iface: marketIface, fn: 'feeBps', args: [] },
    { target: M, iface: marketIface, fn: 'nextListingId', args: [] },
    { target: M, iface: marketIface, fn: 'owner', args: [] },
    { target: M, iface: marketIface, fn: 'isSealed', args: [] },
  ], block);
  const [cpuCount, deployFee, protocolFee, protocolWallet, bem, transistorBeacon, circuitBeacon,
    factoryOwner, factorySealed, marketFeeBps, marketNextListingId, marketOwner, marketSealed] = globals;
  if (cpuCount === null) throw new Error('factory.cpuCount() failed — cannot enumerate');
  const count = Number(cpuCount);
  console.log(`[census] cpuCount = ${count}`);

  const beaconIface = new ethers.Interface(ABIS.beacon);
  const beaconImpls = await batchCalls(provider, mc, [
    { target: circuitBeacon, iface: beaconIface, fn: 'implementation', args: [] },
    { target: transistorBeacon, iface: beaconIface, fn: 'implementation', args: [] },
  ], block);

  // ---- round A: enumerate processor addresses ------------------------------
  const addrCalls = [];
  for (let i = 0; i < count; i++) addrCalls.push({ target: F, iface: factoryIface, fn: 'cpuAt', args: [i] });
  const addresses = await batchCalls(provider, mc, addrCalls, block);
  console.log(`[census] enumerated ${addresses.filter(Boolean).length}/${count} processors`);

  // ---- round B: per-CPU reads ------------------------------------------------
  const cpuCalls = [];
  addresses.forEach((a) => {
    if (!a) return;
    cpuCalls.push(
      { target: a, iface: cpuIface, fn: 'name', args: [] },
      { target: a, iface: cpuIface, fn: 'symbol', args: [] },
      { target: a, iface: cpuIface, fn: 'nextId', args: [] },
      { target: a, iface: cpuIface, fn: 'transistors', args: [] },
    );
  });
  const cpuRes = await batchCalls(provider, mc, cpuCalls, block);
  console.log('[census] per-CPU reads done');

  // ---- round C: per-transistor-contract reads --------------------------------
  const trCalls = [];
  const trTargets = [];
  addresses.forEach((a, i) => {
    if (!a) return;
    const t = cpuRes[i * 4 + 3];
    if (!t) return;
    trTargets.push(i);
    trCalls.push(
      { target: t, iface: trIface, fn: 'creator', args: [] },
      { target: t, iface: trIface, fn: 'mintPrice', args: [] },
      { target: t, iface: trIface, fn: 'minted', args: [] },
      { target: t, iface: trIface, fn: 'supplyCap', args: [] },
    );
  });
  const trRes = await batchCalls(provider, mc, trCalls, block);
  console.log('[census] transistor reads done');

  // ---- paced storage/code reads: beacon slot + code size per CPU -------------
  const altProvider = new ethers.JsonRpcProvider(config.chains.mainnet.rpcAlt);
  const ioProviders = [provider, altProvider];
  const slots = await pacedMap(addresses, async (a) => {
    if (!a) return { beacon: null, codeBytes: null };
    const b = await readWithRetry(
      (p) => p.getStorage(a, config.slots.beacon, block).then(slotToAddress), ioProviders).catch(() => null);
    const c = await readWithRetry(
      (p) => p.getCode(a, block).then((code) => (code.length - 2) / 2), ioProviders).catch(() => null);
    return { beacon: b, codeBytes: c };
  });
  console.log('[census] storage/code reads done');

  // ---- assemble ---------------------------------------------------------------
  const processors = [];
  const errors = [];
  addresses.forEach((a, i) => {
    if (!a) { errors.push({ index: i, stage: 'enumerate' }); return; }
    const [name, symbol, nextId, trAddr] = cpuRes.slice(i * 4, i * 4 + 4);
    const trIdx = trTargets.indexOf(i);
    const [creator, mintPrice, minted, supplyCap] = trIdx >= 0
      ? trRes.slice(trIdx * 4, trIdx * 4 + 4)
      : [null, null, null, null];
    const beacon = slots[i].beacon;
    const impl = beacon && ethers.getAddress(beacon) === ethers.getAddress(circuitBeacon) ? beaconImpls[0] : null;
    const p = {
      index: i,
      address: a,
      name: name ?? null,
      symbol: symbol ?? null,
      creator: creator ?? null,
      owner: creator ?? null, // the transistor contract's creator() is the processor's owner of record
      beacon,
      implementation: impl,
      codeBytes: slots[i].codeBytes,
      circuitsEtched: nextId !== null && nextId !== undefined ? Number(nextId) : null,
      transistors: trAddr ? {
        contract: trAddr,
        mintPriceWei: mintPrice !== null && mintPrice !== undefined ? mintPrice.toString() : null,
        mintPriceOKB: mintPrice !== null && mintPrice !== undefined ? ethers.formatEther(mintPrice) : null,
        minted: minted !== null && minted !== undefined ? Number(minted) : null,
        supplyCap: supplyCap !== null && supplyCap !== undefined ? Number(supplyCap) : null,
        soldOut: minted != null && supplyCap != null ? Number(minted) >= Number(supplyCap) && Number(supplyCap) > 0 : null,
      } : null,
    };
    if (p.name === null || p.circuitsEtched === null || !p.transistors) errors.push({ index: i, stage: 'reads', address: a });
    if (p.beacon === null || p.codeBytes === null) errors.push({ index: i, stage: 'storage', address: a });
    processors.push(p);
  });

  const stats = {
    cpuCount: count,
    read: processors.length,
    totalCircuitsEtched: processors.reduce((s, p) => s + (p.circuitsEtched || 0), 0),
    totalTransistorsMinted: processors.reduce((s, p) => s + (p.transistors?.minted || 0), 0),
    processorsWithCircuits: processors.filter((p) => (p.circuitsEtched || 0) > 0).length,
    processorsNeverEtched: processors.filter((p) => p.circuitsEtched === 0).length,
    processorsSoldOut: processors.filter((p) => p.transistors?.soldOut).length,
    processorsFreeMint: processors.filter((p) => p.transistors?.mintPriceWei === '0').length,
  };

  const snapshot = {
    tool: 'FabReceipt census scanner (phase B)',
    version: 2,
    chain: config.chains.mainnet.name,
    chainId: Number(net.chainId),
    block,
    takenAt: new Date().toISOString(),
    factory: {
      ...factoryProbe,
      cpuCount: count,
      deployFeeWei: deployFee?.toString() ?? null,
      protocolFeeRaw: protocolFee?.toString() ?? null,
      protocolWallet, bemToken: bem, owner: factoryOwner, isSealed: factorySealed,
    },
    market: {
      ...marketProbe,
      feeBps: marketFeeBps !== null && marketFeeBps !== undefined ? Number(marketFeeBps) : null,
      nextListingId: marketNextListingId !== null && marketNextListingId !== undefined ? Number(marketNextListingId) : null,
      owner: marketOwner, isSealed: marketSealed,
    },
    beacons: {
      circuit: { address: circuitBeacon, implementation: beaconImpls[0] },
      transistor: { address: transistorBeacon, implementation: beaconImpls[1] },
    },
    stats,
    errors,
    processors,
  };

  const outFile = process.argv[2] || path.join(__dirname, '..', 'data', `census-${block}.json`);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  const json = JSON.stringify(snapshot, null, 2);
  fs.writeFileSync(outFile, json);
  fs.writeFileSync(path.join(__dirname, '..', 'data', 'snapshot-latest.json'), json);
  fs.writeFileSync(path.join(__dirname, '..', 'dashboard', 'snapshot-latest.json'), json);
  console.log(`[census] stats: ${JSON.stringify(stats)}`);
  console.log(`[census] snapshot written: ${outFile}`);
}

main().catch((e) => { console.error('[census] FAILED:', e.message || e); process.exit(1); });
