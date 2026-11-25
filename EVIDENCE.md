# FabReceipt — on-chain evidence trail

All reads are read-only `eth_call` / `eth_getStorageAt` / `eth_getCode` against
`https://rpc.xlayer.tech` (X Layer mainnet, chain 196), verifiable by re-running
the scanner. No transactions were sent to mainnet; nothing was spent.

## Protocol contracts (Phase A snapshot, block 76,812,763)

`data/snapshot-76812763.json` — `node scanner/scan.js`

- Factory `0x1f09daefa827f02cbb40967cc91b259763760761`: 130-byte EIP-1967 proxy,
  implementation `0x336e9F0F4c3fEe7C8c803377e4DEA00293f4ae2a` (9,376 bytes), no admin slot set.
- Market `0xd89f358c48a7B632c9845af2a02A32eB90DD75DB`: 130-byte EIP-1967 proxy,
  implementation `0x38d688F4793a9Bf270c2c99492c9a1e45163dB6E` (7,405 bytes), no admin slot set.

## ABI discovery

Method and full findings in `scanner/ABI.md` (selector extraction from the
implementation bytecode → OpenChain signature database → on-chain confirmation
of every read via `scanner/probe-*.js`). Headline results: factory enumerates
processors via `cpuCount()`/`cpuAt(uint256)`; each processor is an ERC-721
circuit collection behind a beacon proxy; each processor's ERC-1155 transistor
contract carries `creator()`, `mintPrice()`, `minted()`, `supplyCap()`.

## Full census (block 76,813,166)

`data/census-76813166.json` — `node scanner/census.js` (Multicall3-batched,
block-pinned; zero read errors)

- 449/449 processors read. 12,202 circuits etched in total.
- 332 processors have etched ≥1 circuit; 117 never etched; 52 sold out; 66 free-mint.
- All 449 processors: 295-byte code, beacon `0xf70d1ed4f62CF3780157B0b421b7E2F45bD0991C`,
  implementation `0x977f217887E085D298Cb3819cDAD5A0ee35F29B2`.
- Top producers: CPU[323] FAB-Genisis 7,160 circuits; CPU[265] TAPELIQUID 1,405;
  CPU[222] "9898" 1,022 — top 3 ≈ 79% of all circuits, matching the October
  census's concentration finding at a larger scale.
- Two test processors (CPU[180], CPU[404]) carry astronomical transistor caps
  (up to 1e28); the aggregate minted total is dominated by them. Per-processor
  figures in the snapshot are exact.

## Snapshot diffs

- `data/diff-76812763-76813166.txt` — Phase A → census (403 blocks): **no
  protocol changes**; factory and market implementations unchanged.
- `data/diff-76813060-76813166-fixed.txt` — census → census (106 blocks): the
  only event is a *data-completeness* note. The first census run lost 445/449
  storage reads to public-RPC throttling (recorded as nulls); the diff engine
  was hardened to treat one-sided nulls as read gaps, never as on-chain
  changes, and the census scanner now retries storage reads across both public
  RPC endpoints (second run: zero errors). No on-chain changes occurred
  between the two censuses.
- A third census at block 76,813,465 (`data/census-76813465.json`) diffed
  against block 76,813,166 (`data/diff-76813166-76813465.txt`): **no changes**
  in 299 blocks — a stated no-change window; all three censuses agree exactly
  (449 processors, 12,202 circuits).
- Engine self-test (`data/diff-synthetic-selftest.txt`): a copy of the
  76,813,465 census with eight synthetic mutations (factory implementation
  swap, price move, new etches, first etch, sellout, mint surge, new
  processor, cpuCount bump) — the diff engine flagged all eight correctly,
  proving the detection paths that a quiet 5-minute window cannot exercise.
- Historical context (third-party, October 2026): the factory implementation
  was observed to change between blocks 73,915,245 and 73,947,001 — the class
  of event FabReceipt exists to catch; see RESEARCH.md.

## Testnet anchor (X Layer testnet, chain 1952)

- ReceiptAnchor compiles (`contracts/build/`); deploy script
  `contracts/deploy-testnet.js` is chain-guarded to 1952 and ready.
- Deployer wallet (fresh, local-only key): `0xB9e592851A982B1C9406ca4C24D8FFD9D6224BB2`.
- **Pending a Karis step:** the OKX testnet faucet is captcha-gated in the
  browser (third-party faucets for 1952 also require hCaptcha or wallet
  sign-in), so the deployer cannot be funded agent-side. Once Karis claims
  0.2 testnet OKB to the deployer address from
  https://www.okx.com/xlayer/faucet, one command deploys ReceiptAnchor and
  anchors the census snapshot hash; tx hashes will be recorded here and in
  `data/anchor-testnet.json`.
