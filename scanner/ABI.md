# TapeOut ABI discovery — method and findings (2026-11-25)

The TapeOut factory/market on X Layer mainnet are **not verified on Sourcify** and no
official ABI is published. The ABIs in `abi.js` were reverse-engineered read-only:

1. **Proxy resolution.** The factory (`0x1f09daefa827f02cbb40967cc91b259763760761`)
   and market (`0xd89f358c48a7B632c9845af2a02A32eB90DD75DB`) are 130-byte EIP-1967
   proxies. Implementations (read via the scanner, block 76,812,763):
   factory → `0x336e9F0F4c3fEe7C8c803377e4DEA00293f4ae2a` (9,376 bytes),
   market → `0x38d688F4793a9Bf270c2c99492c9a1e45163dB6E` (7,405 bytes).
   Both are UUPS-upgradeable + Ownable (`upgradeToAndCall`, `proxiableUUID`,
   `owner`, `seal()`/`isSealed()` present in both).
2. **Selector extraction.** `scanner/discover-selectors.js` scans implementation
   bytecode for PUSH4 immediates (dispatcher selectors + embedded constants).
3. **Signature resolution.** Selectors were resolved against the OpenChain
   signature database (`api.openchain.xyz/signature-database/v1/lookup`,
   filter=true; every signature used below has `hasVerifiedContract: true`).
4. **On-chain confirmation.** Every read used by the census was executed against
   the live contracts at a pinned block (`scanner/probe-factory.js`,
   `scanner/probe-cpu.js`, `scanner/probe-market.js`). Selectors that appear in
   bytecode but revert on the target (e.g. `BEM()`/`transistors()` constants the
   factory embeds for cross-calls) were discarded in favour of the forms that
   actually answer (`bem()`, per-CPU `transistors()`).

## Architecture the ABI reveals

- **Factory** enumerates processors: `cpuCount()` (449 at block 76,813,060),
  `cpuAt(uint256)`, `cpus(uint256)`, `isCPU(address)`. Creation:
  `createCPU(string,string,string,uint256,uint256)`, gated by `deployFee()`
  (raw 10000000 wei at census block) and `protocolFee()` (raw 1000000).
  `bem()` → BEM token on X Layer `0x60e62Efa9405d6873C5deaBD4E6CC91c25363952`.
  `protocolWallet()` → `0x571d447f4f24688eC35Ccf07f1D6993655F6aF15`.
- **Processors ("CPUs") are BeaconProxies** (295 bytes) on the factory's
  `circuitBeacon()` (`0xf70d1ed4f62CF3780157B0b421b7E2F45bD0991C`), whose current
  implementation is `0x977f217887E085D298Cb3819cDAD5A0ee35F29B2`. One beacon
  upgrade would change every processor at once — a first-class FabReceipt alert.
  Each CPU is an **ERC-721** collection of its own circuits: `name()`, `symbol()`,
  `nextId()` = circuits etched (token ids are **1-based**: `ownerOf(0)` reverts
  `ERC721NonexistentToken`, `ownerOf(nextId)` exists — verified on CPU[0]),
  `tapeout(bytes,uint32,uint32)` etches, `eval`/`step`/`circuitInfo`/`netlist`
  read circuit data.
- **Transistor contracts**: each CPU has its own ERC-1155 behind a BeaconProxy on
  `transistorBeacon()` (`0x1059Ad62cAbB6a6925bb65aA617300556c60A51B` → impl
  `0x265bf10faB9ddEC0eE0A649C6B9DB845f1b9a06b`), reached via the CPU's
  `transistors()`. It carries the processor's economics and owner of record:
  `creator()`, `mintPrice()` (wei per transistor), `minted()`, `supplyCap()`,
  plus `cpuName()`/`cpuSymbol()`/`story()`. Token id 0 = NAND, 1 = LATCH.
  (It does not implement ERC-1155 `totalSupply(uint256)` — `minted()` is the
  counter; the CPU contract's `NAND()`/`LATCH()` selectors revert and were
  dropped.)
- **Market** is a thin secondary-listing contract: `feeBps()` = 100 (1%),
  `nextListingId()` = 4 (only four listings ever created; listing 0 is empty),
  `listings`/`listingView`/`listingOf` structs raw-probed but not fully decoded
  (not needed for receipts). Primary transistor sales happen through each
  transistor contract's own `mint`, not the market.

## Census reads (per processor)

`cpuAt(i)` → CPU `name()`, `symbol()`, `nextId()`, `transistors()` → transistor
`creator()`, `mintPrice()`, `minted()`, `supplyCap()` → plus the CPU's EIP-1967
beacon slot and code size. Bulk calls go through Multicall3
(`0xcA11bde05977b3631167028862bE2a173976CA11`); storage/code reads are paced with
retries across both public RPC endpoints because the public RPC throttles bursts
(first census run lost 445/449 storage reads to throttling before the retry
hardening — the multicall rounds were unaffected).
