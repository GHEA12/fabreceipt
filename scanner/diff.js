#!/usr/bin/env node
// FabReceipt snapshot diff engine.
//
// Compares two FabReceipt snapshots (Phase A integrity snapshots and/or Phase B
// census snapshots) and produces a human-readable change log plus a JSON event
// list. Flags: protocol implementation upgrades (factory / market / beacons),
// new processors, per-processor implementation or identity changes, transistor
// price moves, new circuits etched (incl. first-ever etch), transistor minting
// and sellouts.
//
// Usage: node scanner/diff.js <older.json> <newer.json> [outPrefix]
// Writes <outPrefix>.txt and <outPrefix>.json (default: data/diff-<a>-<b>),
// refreshes data/diff-latest.json for the dashboard, and prints the text log.
'use strict';

const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');

function protocolView(s) {
  // Normalize Phase A (contracts[]) and Phase B (factory/market) snapshots.
  if (s.version === 2) {
    return {
      factoryImpl: s.factory?.implementation ?? null,
      factoryAdmin: s.factory?.admin ?? null,
      marketImpl: s.market?.implementation ?? null,
      marketAdmin: s.market?.admin ?? null,
      circuitBeaconImpl: s.beacons?.circuit?.implementation ?? null,
      transistorBeaconImpl: s.beacons?.transistor?.implementation ?? null,
      cpuCount: s.factory?.cpuCount ?? null,
      deployFeeWei: s.factory?.deployFeeWei ?? null,
      marketFeeBps: s.market?.feeBps ?? null,
    };
  }
  const by = (label) => (s.contracts || []).find((c) => c.label === label) || {};
  const f = by('TapeOut CPU factory'), m = by('TapeOut market');
  return {
    factoryImpl: f.implementation ?? null, factoryAdmin: f.admin ?? null,
    marketImpl: m.implementation ?? null, marketAdmin: m.admin ?? null,
    circuitBeaconImpl: null, transistorBeaconImpl: null,
    cpuCount: null, deployFeeWei: null, marketFeeBps: null,
  };
}

function diffSnapshots(a, b) {
  const events = [];
  const push = (scope, type, msg, extra = {}) => events.push({ scope, type, msg, ...extra });
  const pa = protocolView(a);
  const pb = protocolView(b);

  if (pa.factoryImpl !== pb.factoryImpl) push('protocol', 'implementation-changed',
    `Factory implementation changed: ${pa.factoryImpl} -> ${pb.factoryImpl}`,
    { field: 'factory.implementation', before: pa.factoryImpl, after: pb.factoryImpl });
  if (pa.marketImpl !== pb.marketImpl) push('protocol', 'implementation-changed',
    `Market implementation changed: ${pa.marketImpl} -> ${pb.marketImpl}`,
    { field: 'market.implementation', before: pa.marketImpl, after: pb.marketImpl });
  if (pa.factoryAdmin !== pb.factoryAdmin) push('protocol', 'admin-changed',
    `Factory admin changed: ${pa.factoryAdmin} -> ${pb.factoryAdmin}`,
    { field: 'factory.admin', before: pa.factoryAdmin, after: pb.factoryAdmin });
  if (pa.marketAdmin !== pb.marketAdmin) push('protocol', 'admin-changed',
    `Market admin changed: ${pa.marketAdmin} -> ${pb.marketAdmin}`,
    { field: 'market.admin', before: pa.marketAdmin, after: pb.marketAdmin });
  if (pa.circuitBeaconImpl && pb.circuitBeaconImpl && pa.circuitBeaconImpl !== pb.circuitBeaconImpl)
    push('protocol', 'implementation-changed',
      `Circuit beacon implementation changed (affects EVERY processor): ${pa.circuitBeaconImpl} -> ${pb.circuitBeaconImpl}`,
      { field: 'beacons.circuit.implementation', before: pa.circuitBeaconImpl, after: pb.circuitBeaconImpl });
  if (pa.transistorBeaconImpl && pb.transistorBeaconImpl && pa.transistorBeaconImpl !== pb.transistorBeaconImpl)
    push('protocol', 'implementation-changed',
      `Transistor beacon implementation changed (affects EVERY transistor contract): ${pa.transistorBeaconImpl} -> ${pb.transistorBeaconImpl}`,
      { field: 'beacons.transistor.implementation', before: pa.transistorBeaconImpl, after: pb.transistorBeaconImpl });
  if (pa.cpuCount !== null && pb.cpuCount !== null && pa.cpuCount !== pb.cpuCount)
    push('protocol', 'cpu-count-changed', `Registered processors: ${pa.cpuCount} -> ${pb.cpuCount}`,
      { field: 'factory.cpuCount', before: pa.cpuCount, after: pb.cpuCount });
  if (pa.deployFeeWei && pb.deployFeeWei && pa.deployFeeWei !== pb.deployFeeWei)
    push('protocol', 'fee-changed', `Factory deployFee: ${pa.deployFeeWei} wei -> ${pb.deployFeeWei} wei`,
      { field: 'factory.deployFeeWei', before: pa.deployFeeWei, after: pb.deployFeeWei });
  if (pa.marketFeeBps !== null && pb.marketFeeBps !== null && pa.marketFeeBps !== pb.marketFeeBps)
    push('protocol', 'fee-changed', `Market feeBps: ${pa.marketFeeBps} -> ${pb.marketFeeBps}`,
      { field: 'market.feeBps', before: pa.marketFeeBps, after: pb.marketFeeBps });

  if (a.version === 2 && b.version === 2) {
    const mapA = new Map(a.processors.map((p) => [p.index, p]));
    let dataGaps = 0; // fields unread (null) in the older snapshot, populated in the newer
    // A null on either side is a read gap, never an on-chain change: only compare
    // values that were actually read in BOTH snapshots.
    const cmp = (qv, pv) => {
      if (qv === null || qv === undefined || pv === null || pv === undefined) { dataGaps++; return false; }
      return qv !== pv;
    };
    for (const p of b.processors) {
      const q = mapA.get(p.index);
      const tag = `CPU[${p.index}] ${p.name || ''} (${p.address})`;
      if (!q) { push('processor', 'new-processor', `${tag}: NEW processor registered`, { index: p.index }); continue; }
      if (cmp(q.implementation, p.implementation))
        push('processor', 'implementation-changed', `${tag}: implementation ${q.implementation} -> ${p.implementation}`,
          { index: p.index, field: 'implementation', before: q.implementation, after: p.implementation });
      if (cmp(q.beacon, p.beacon))
        push('processor', 'beacon-changed', `${tag}: beacon ${q.beacon} -> ${p.beacon}`,
          { index: p.index, field: 'beacon', before: q.beacon, after: p.beacon });
      if (cmp(q.name, p.name) || cmp(q.symbol, p.symbol))
        push('processor', 'identity-changed', `${tag}: name/symbol "${q.name}"/"${q.symbol}" -> "${p.name}"/"${p.symbol}"`,
          { index: p.index, field: 'name', before: q.name, after: p.name });
      if (cmp(q.creator, p.creator))
        push('processor', 'creator-changed', `${tag}: creator ${q.creator} -> ${p.creator}`,
          { index: p.index, field: 'creator', before: q.creator, after: p.creator });
      const qa = q.transistors || {}, na = p.transistors || {};
      if (cmp(qa.mintPriceWei, na.mintPriceWei))
        push('processor', 'price-changed',
          `${tag}: transistor price ${ethers.formatEther(qa.mintPriceWei)} OKB -> ${ethers.formatEther(na.mintPriceWei)} OKB`,
          { index: p.index, field: 'transistors.mintPriceWei', before: qa.mintPriceWei, after: na.mintPriceWei });
      if (cmp(qa.supplyCap, na.supplyCap))
        push('processor', 'supply-cap-changed', `${tag}: transistor supply cap ${qa.supplyCap} -> ${na.supplyCap}`,
          { index: p.index, field: 'transistors.supplyCap', before: qa.supplyCap, after: na.supplyCap });
      if (q.circuitsEtched !== null && p.circuitsEtched !== null && p.circuitsEtched !== q.circuitsEtched) {
        const d = p.circuitsEtched - q.circuitsEtched;
        if (d > 0) {
          push('processor', q.circuitsEtched === 0 ? 'first-etch' : 'circuits-etched',
            `${tag}: ${d} new circuit(s) etched (${q.circuitsEtched} -> ${p.circuitsEtched})${q.circuitsEtched === 0 ? ' — FIRST ETCH' : ''}`,
            { index: p.index, field: 'circuitsEtched', before: q.circuitsEtched, after: p.circuitsEtched });
        } else {
          push('processor', 'circuits-decreased', `${tag}: circuit count DECREASED ${q.circuitsEtched} -> ${p.circuitsEtched} (unexpected)`,
            { index: p.index, field: 'circuitsEtched', before: q.circuitsEtched, after: p.circuitsEtched });
        }
      }
      if (qa.minted !== null && na.minted !== null && qa.minted !== undefined && na.minted !== undefined && na.minted !== qa.minted)
        push('processor', 'transistors-minted', `${tag}: transistors minted ${qa.minted} -> ${na.minted} (+${na.minted - qa.minted})`,
          { index: p.index, field: 'transistors.minted', before: qa.minted, after: na.minted });
      if (!qa.soldOut && na.soldOut)
        push('processor', 'sold-out', `${tag}: transistors SOLD OUT (minted ${na.minted} of cap ${na.supplyCap})`,
          { index: p.index, field: 'transistors.soldOut', before: qa.soldOut, after: na.soldOut });
    }
    for (const q of a.processors) {
      if (!b.processors.find((p) => p.index === q.index))
        push('processor', 'processor-missing', `CPU[${q.index}] ${q.name || ''} (${q.address}): present in older snapshot, MISSING in newer (registry is append-only — investigate)`,
          { index: q.index });
    }
    if (dataGaps > 0)
      push('data', 'read-completeness',
        `${dataGaps} processor field(s) were unread (null) in one snapshot and populated in the other — a scanner read gap, NOT an on-chain change. Affected comparisons were skipped.`,
        { fields: dataGaps });
  }
  return events;
}

function renderText(a, b, events) {
  const lines = [];
  lines.push('FabReceipt snapshot diff');
  lines.push(`  older: block ${a.block} (${a.takenAt}) — ${a.tool}`);
  lines.push(`  newer: block ${b.block} (${b.takenAt}) — ${b.tool}`);
  lines.push(`  block distance: ${b.block - a.block}`);
  if (a.version !== 2 || b.version !== 2) {
    lines.push('  note: at least one snapshot is a Phase A integrity snapshot (protocol contracts only);');
    lines.push('        processor-level comparison requires two census (v2) snapshots.');
  }
  lines.push('');
  if (!events.length) {
    lines.push('NO CHANGES DETECTED in the compared fields between the two snapshots.');
  } else {
    lines.push(`${events.length} change event(s):`);
    for (const e of events) lines.push(`  [${e.scope}/${e.type}] ${e.msg}`);
  }
  return lines.join('\n') + '\n';
}

async function main() {
  const [fa, fb, outPrefixArg] = process.argv.slice(2);
  if (!fa || !fb) { console.error('usage: node scanner/diff.js <older.json> <newer.json> [outPrefix]'); process.exit(1); }
  const a = JSON.parse(fs.readFileSync(fa, 'utf8'));
  const b = JSON.parse(fs.readFileSync(fb, 'utf8'));
  const events = diffSnapshots(a, b);
  const text = renderText(a, b, events);
  const outPrefix = outPrefixArg || path.join(__dirname, '..', 'data', `diff-${a.block}-${b.block}`);
  fs.writeFileSync(outPrefix + '.txt', text);
  const payload = { from: { block: a.block, takenAt: a.takenAt, file: path.basename(fa) },
    to: { block: b.block, takenAt: b.takenAt, file: path.basename(fb) }, events };
  fs.writeFileSync(outPrefix + '.json', JSON.stringify(payload, null, 2));
  fs.writeFileSync(path.join(__dirname, '..', 'data', 'diff-latest.json'), JSON.stringify(payload, null, 2));
  fs.writeFileSync(path.join(__dirname, '..', 'dashboard', 'diff-latest.json'), JSON.stringify(payload, null, 2));
  process.stdout.write(text);
  console.log(`[diff] written: ${outPrefix}.txt / .json`);
}

if (require.main === module) main().catch((e) => { console.error('[diff] FAILED:', e.message || e); process.exit(1); });
module.exports = { diffSnapshots, renderText, protocolView };
