# FabReceipt — plan for X Layer TapeOut Accelerate (deadline 8 Dec 2026, 06:59 WIB)

## Concept (chosen)

**FabReceipt — a living safety-and-activity receipt for every TapeOut processor on X Layer.**

TapeOut's X Layer ecosystem already has ~389 processors and 11,000+ circuits, real OKB changing hands for transistors, and upgradeable protocol contracts whose implementation has already silently changed once — yet a buyer has no way to answer basic questions before spending: Is this processor real and active, or one of the 111 that never fabricated anything? What does it charge per transistor, and did that price just change? Did the contracts behind it get upgraded last night? FabReceipt reads TapeOut's factory, market and processor contracts directly from X Layer mainnet (no indexer, no API key), keeps block-pinned snapshots, and turns them into a public receipt per processor: identity (contracts + current implementation), economics (transistor price, supply, minted), production (circuits etched over time), and a change log (implementation upgrades, price moves, first etch, sellout). A diff engine flags changes between snapshots, and each snapshot's hash is anchored on-chain so the history itself is tamper-evident.

Why this concept:
- **Eligibility is structural, not bolted on:** the brief allows projects that "use TapeOut circuits, contracts, or **onchain data** on X Layer" — FabReceipt is built entirely on TapeOut on-chain data (factory 0x1f09daefa827f02cbb40967cc91b259763760761, market 0xd89f358c48a7B632c9845af2a02A32eB90DD75DB, and every registered processor).
- **The need is already demonstrated:** two independent one-off analyses (a dev.to integrity comparison and the openwitness.net census) did by hand, once, what FabReceipt does continuously as a product. 111/389 processors never produced a circuit and the factory implementation changed without any public notice — exactly the trust gap.
- **It is provable today, for free:** X Layer mainnet RPC answers from this sandbox; read-only proof needs no wallet, no OKB, no Karis step. (TapeOut has no testnet deployment — see RESEARCH.md §3 — so a swap/agent concept ported from Sentinel would have nothing real to integrate with; this concept turns that constraint into the design.)
- **Judging fit:** User Value (buyers, processor creators, marketplaces all need this), Innovation (first continuous integrity/change monitoring for TapeOut; expands TapeOut into the trust-tooling use case), Ecosystem Integration (deep use of TapeOut contracts and data; roadmap hooks for TapeSend alerts and DeWEB hosting), Product Readiness (live dashboard, complete journey: search a processor → read its receipt → verify a circuit before buying).

Alternatives considered and rejected: porting Sentinel (needs a DEX; no testnet DEX, and zero TapeOut usage = ineligible); a tap game with circuit-verified rules (TapeCode's game workflow already does this and a near-identical game is being sold as a template entry); an agent-escrow product on the draft TAP agent-payment standard (the standard is a weeks-old draft — building to it is speculation, though it is a good roadmap slide).

## Architecture

- **Scanner** (`project/scanner/`, Node + ethers, read-only): connects to https://rpc.xlayer.tech; Phase A (done in scaffold): block height, code size, and EIP-1967 implementation/beacon slots for the factory and market. Phase B (build): factory ABI discovery (implementation contract → view-function probing), enumerate registered processors, per-processor reads (creator, transistor price, supply/minted, circuits etched via nextId/counters), market reads. Writes block-pinned JSON snapshots to `project/data/`.
- **Diff engine** (`project/scanner/diff.js`): compares two snapshots; emits change events (implementation changed, price changed, first circuit, sold out, new processor) with block numbers and before/after values — the same evidence discipline as our earlier hunts.
- **Anchor contract** (`project/contracts/ReceiptAnchor.sol`): minimal owner-run registry that stores snapshot content hashes with block references. Deployed on **X Layer testnet (1952)** for the live proof (faucet OKB), so anyone can verify a receipt page against the hash anchored at the time. (Mainnet anchoring is a post-hackathon/Karis decision.)
- **Dashboard** (`project/dashboard/`, dependency-free static page, Sentinel pattern): processor list with search, per-processor receipt view, change-log feed, "verify before you buy" checker (paste a processor or circuit address → live read + receipt). Hosted as a static page for the submission access link (GitHub Pages from the public repo); DeWEB/TapeCode hosting is the ecosystem roadmap item, not a dependency.
- **Alerts (stretch):** change events exported as JSON/RSS; TapeSend delivery is a documented roadmap hook (TapeSend is a named ecosystem tool in the judging criteria).

## Build steps

1. ✅ Research verified (RESEARCH.md); RPC reachability proven; factory/market presence proven on mainnet, absence on testnet proven.
2. ✅ Scaffold: scanner (Phase A live snapshot), anchor contract (compiles), dashboard skeleton rendering the real snapshot.
3. ✅ Factory ABI discovery (2026-11-25): implementations resolved (factory 0x336e9F0F…, market 0x38d688F4…), selectors extracted from bytecode and resolved via the OpenChain signature database, every census read confirmed on-chain. Enumeration = factory `cpuCount()`/`cpuAt(i)`; per-processor state = CPU ERC-721 `nextId()` (circuits etched, 1-based ids) + its ERC-1155 transistor contract (`creator()`, `mintPrice()`, `minted()`, `supplyCap()`). All processors are beacon proxies on one circuit beacon (impl 0x977f2178…). Method + full findings: `project/scanner/ABI.md`.
4. ✅ Full census at pinned blocks (2026-11-25): **449 processors** (Oct census: 389), **12,202 circuits etched**, 117 never etched, 52 sold out — three censuses (blocks 76,813,060 / 76,813,166 / 76,813,465) agree; the final two are complete with zero read errors (the first run exposed public-RPC throttling of storage reads; the scanner now retries across both RPC endpoints). Diff engine built (`scanner/diff.js`): Phase A→census and census→census diffs show **no on-chain changes** in their windows (stated no-change windows), a one-sided-null hardening prevents read gaps from being reported as changes, and a synthetic self-test proves all eight event types (impl change, price move, etches, first etch, sellout, mint surge, new processor, count change) are detected. Evidence: `EVIDENCE.md`, `project/data/`.
5. ◐ Receipt pages done: the dashboard renders the real census (searchable list, protocol + beacon cards, change log) and a per-processor receipt view (identity / economics / production / change flags) via `#/cpu/<index>`. The "verify before you buy" live checker is NOT built yet. ReceiptAnchor testnet deploy is **prepared but blocked on the faucet**: the OKX faucet (and third-party 1952 faucets) require captcha/wallet sign-in, so funding the deployer is a Karis browser step — deployer `0xB9e592851A982B1C9406ca4C24D8FFD9D6224BB2`, claim 0.2 testnet OKB at https://www.okx.com/xlayer/faucet, then `node contracts/deploy-testnet.js` deploys + anchors the census hash in one run (script written and dry-verified: chain-guarded to 1952, exits cleanly while unfunded).
6. ◐ Public repo staged at `repo-upload/` (README draft, EVIDENCE.md, scanner/contracts/dashboard/data, secret-scanned, no keys or .env) — waiting on Karis to create the GitHub repo; then upload + GitHub Pages for the dashboard URL.
7. Submission pack: description covering product, target users + reach, revenue model (freemium: public receipts free; paid monitoring/alerts for processor creators and marketplace/wallet integrations; per-lookup API for pro users), TapeOut usage explanation with all addresses; demo video ≤3 min (same Bacireng production pipeline as ListGuard: live terminal footage + TTS narration, Karis reviews).
8. Submit via the official form before **7 Dec 2026, 23:59 UTC** (form fill is a browser step with Karis — it carries his entrant details).

## What can be proven, and where

- **Mainnet, read-only, free (now):** factory/market existence + proxy implementations; full processor census; price/production stats; change detection between snapshots. This is the core TapeOut proof and needs nobody's wallet.
- **Testnet (1952), faucet-funded:** ReceiptAnchor deployment + hash anchoring txs.
- **Not claimed:** no TapeOut writes (we never mint transistors or etch circuits — that would need a funded mainnet wallet and is listed as an optional Karis-funded stretch: open a FabReceipt processor and etch one circuit, ~0.0066 OKB + component costs, only if Karis wants the deeper integration story).

## Submission checklist

- [x] Brief verified from the official page (RESEARCH.md)
- [x] Concept + architecture chosen; scaffold builds/runs
- [x] Factory ABI discovered; census scan reproduced at a pinned block (449 processors at block 76,813,166, zero read errors)
- [x] Snapshot diff demonstrated (two stated no-change windows + read-gap hardening + synthetic self-test firing all 8 event types; the motivating real event — the Oct 2026 factory implementation change — is documented in RESEARCH.md)
- [ ] ReceiptAnchor live on testnet with ≥1 anchored snapshot hash — deploy tooling ready; blocked on Karis claiming faucet OKB to deployer 0xB9e592851A982B1C9406ca4C24D8FFD9D6224BB2 (captcha-gated)
- [ ] Dashboard live at a public URL rendering real data — built and rendering the real census locally; public URL waits on the GitHub repo (Karis step)
- [ ] Public GitHub repo with README + evidence — files staged in repo-upload/; repo creation is a Karis step
- [ ] Demo video ≤3 min, reviewed by Karis
- [ ] Submission description written (product, users, revenue model, TapeOut usage + addresses)
- [ ] Submitted via the official form before 7 Dec 2026, 23:59 UTC

## Steps that will need Karis

1. **Create the public GitHub repo** (connector is read-only for writes) — same flow as the previous three entries; Bacireng prepares all files.
2. **Testnet faucet** (only if OKX's faucet is captcha-gated in the agent browser, as faucets usually are): claim testnet OKB to the deployer address Bacireng gives him — a 1-minute browser step like the Solana/HSK faucets.
3. **Submission form** at the end: filled in his browser session with his entrant details; Bacireng prepares every field's text.
4. **Optional stretch (his money, his call):** a small mainnet OKB amount if he wants the deeper TapeOut-write story (open a processor + etch a circuit). Not required for eligibility.
5. **If we win:** identity checks and a self-custodial receiving wallet are his by rule; prizes are milestone-based, agreed post-event.
6. **Demo Day caveat:** if shortlisted, an offline Demo Day is expected (location unpublished) — his decision if that ever happens; it does not block entering.
