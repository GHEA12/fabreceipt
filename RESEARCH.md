# OKX X Layer — TapeOut Accelerate: verified research (2026-11-25)

## 1. Official brief (verified from the official page, 2026-11-25)

Source: https://web3.okx.com/xlayer/build-x-series (OKX Web3, "Crypto Hackathon 2026 | OKX Web3 Developer Challenge"), read in full including terms and FAQ.

- **Organizer:** X Layer (OKX) with the TapeOut protocol/community. Event window per grants.watch: 16 Oct 2026 to 7 Dec 2026.
- **Prize pool: 100,000 USDT.** 1st: 20,000 USDT (1 winner). 2nd: 10,000 USDT each (5 winners). 3rd: 6,000 USDT each (5 winners). Pool may grow with community contributions.
- **Prize payment:** paid **in stages** after the event, against development milestones agreed with each winning team; winners must pass **identity checks** and provide a **self-custodial wallet** (and confirm receiving network). Not a lump sum at announcement.
- **Deadline: 7 Dec 2026, 23:59 UTC = 8 Dec 2026, 06:59 WIB.** The page calls the deadline **provisional**; the event page governs if it changes.
- **Tracks:** there are **no named tracks**. Open directions: apps, games, online services, developer tools, circuit design, and mechanism projects such as PoD. Any category is eligible as long as the TapeOut condition below is met.
- **Hard eligibility condition:** the project must build within the TapeOut ecosystem and **either use TapeOut circuits, contracts, or onchain data on X Layer, or run on X Layer DeWEB**. FAQ confirms: you may build on existing TapeOut processors/circuits/dev tools; interfaces, computation and other features may run off-circuit/off-chain, but the project must use TapeOut circuits/contracts/onchain data and provide the relevant addresses.
- **Eligibility (people):** 18+ (or local majority age) or legal entities; individuals and teams welcome; Restricted Persons under the X Layer Terms of Service are excluded; organizer may verify eligibility. No fee. No anti-AI rule found; winners may face identity checks (so the entrant of record is Karis, as usual).
- **Existing projects:** eligible, but only substantial new development completed during the event is judged, and it must be described.
- **Submission:** through the **submission form** linked from the official page (the fetched page text did not expose the form URL; it is a form on/near the event page, not a DoraHacks-style platform — there is no separate platform registration or BUIDL page). Submission = project description + relevant addresses or links:
  - Description must explain: the product/service, target users and how to reach them, the proposed revenue model, and why users would pay and keep using it. Circuit/tool/mechanism projects may instead explain the use cases and commercial applications they support.
  - Circuit projects must submit the **processor contract address and circuit ID**.
  - Websites/apps/tools must provide an **access link** and explain which TapeOut ecosystem projects or features they use.
  - **Demo video recommended, max 3 minutes**, covering: the problem, a demo of core features, target users and business model, and how the project uses TapeOut/ecosystem tools.
- **Judging criteria** (X Layer + TapeOut teams jointly):
  1. **User Value and Commercial Potential** — real user needs, target market, long-term growth, sustainable operations.
  2. **Innovation** — originality in circuit design, product features or UX; potential to expand TapeOut into new use cases.
  3. **Ecosystem Integration** — effective use of TapeOut or ecosystem capabilities such as **DeWEB, FabX, TapeCode, TapeKit, TapeSend** (no specific tool is required).
  4. **Product Readiness and User Experience** — functional core features, complete user journey, low technical barrier.
  5. **Demo Video** (≤3 min, content as above).
- **Format:** online build; **shortlisted teams attend an offline Demo Day** (location not stated). Winners also get official X Layer PR support and collaboration opportunities.
- **Support channel:** Telegram channel linked from the event page for inquiries/technical support.

## 2. What TapeOut actually is (matters for concept fit)

Sources: tape4fun.com ecosystem reference; TapeOut weekly report (teletype.in, Oct 12–18 2026); AiCoin ecosystem review; PANews beginner guide; dev.to and openwitness.net on-chain analyses (Oct 2026).

- TapeOut is an **on-chain circuit ("hardware manufacturing") protocol**: circuits are composed from NAND (logic) and LATCH (state) components in a browser canvas, then "taped out" — etched on-chain as **Circuit NFTs (ERC-721)**. Circuits compose into **Processors** (each processor is its own contract/shop: opening one costs a flat **0.0066 OKB** on X Layer; the creator sets a per-transistor price; **transistors are ERC-1155** supply used to fabricate circuits). Composed circuits can be called by other contracts (TAP-721 draft: smart contracts on X Layer can call the circuit an NFT is bound to).
- **Proof of Design (PoD):** the protocol publishes computation tasks with clear I/O; developers' circuits complete them; rewards are in **$BEM** (the BNB Chain-origin token; BEM contract on BSC 0x5ce033b2bfca3af30b3e8c8457deaf776a8b695a).
- Ecosystem tools named in judging: **TapeCode** (AI dev/deployment tool: generates apps, auto-audits, creates circuit containers, one-click deploys contracts and DeWEB sites; compute credits are a paid top-up, +50% bonus during the accelerator), **DeWEB** (websites hosted in on-chain circuit containers, reached via the HashPort gateway or a bound regular domain), **FabX**, **TapeKit**, **TapeSend** (multi-chain encrypted messaging using circuit containers as identity), **TapeRelay**, **TapeAPI** (on-chain service identity, signed result verification; pitched for AI services/agents). New TAP standard drafts (Oct 2026) cover **agent authorization and agent payment escrow/spending limits** — the ecosystem is actively moving toward agent infrastructure.
- **Naming trap:** "TapeOut X (TAPEOUTX)" on X Layer is an **unrelated token** (0x16aa672dda63f5acd0de098c04c4a3e957d1eeee) trading on the TapeOut name — not the protocol. Do not touch it.

## 3. TapeOut deployments on X Layer (verified on-chain by Bacireng, 2026-11-25)

- **CPU factory (X Layer mainnet, 196): `0x1f09daefa827f02cbb40967cc91b259763760761`** — code present, **130 bytes = a proxy** (consistent with third-party reads of its EIP-1967 implementation slot). Third-party RPC analysis (dev.to, 23 Oct 2026) read 387→388 registered CPUs across two blocks and observed an implementation-slot change — i.e. the factory is upgradeable and its implementation has already changed at least once.
- **Market (X Layer mainnet, 196): `0xd89f358c48a7B632c9845af2a02A32eB90DD75DB`** — code present, also 130 bytes (proxy).
- **Scale (openwitness.net census, block 74,007,424, 23 Oct 2026):** 389 processors deployed, 11,006 circuits fabricated; 111 processors have never produced a circuit; 56 sold no transistors; production is extremely concentrated (top 3 processors = ~79.5% of circuits). Median processor: 2 circuits.
- **Testnet (1952): the factory and market addresses hold 0 bytes of code** — TapeOut is **not deployed on X Layer testnet** at its mainnet addresses. Consequence: any TapeOut integration is proven against **mainnet read-only data** (free, no wallet, no funds) or against a mainnet deployment (needs real OKB — a Karis funding step). There is no testnet TapeOut to test against.
- Factory/market are **not Sourcify-verified** (checked 2026-11-25: no match). ABI discovery (implementation-slot read → implementation contract → function probing / OKLink) is a build-phase task.

## 4. X Layer chain facts (official OKX docs)

Source: OKX Onchain OS dev docs, "Network information and contracts" (web3.okx.com/onchainos/dev-docs/xlayer/developer/build-on-xlayer/network-information), mirrored in github.com/okx/xlayer-docs; cross-checked with Chainstack docs.

| | Mainnet | Testnet |
|---|---|---|
| Chain ID | **196** (0xc4) | **1952** (0x7a0) |
| RPC | https://rpc.xlayer.tech · https://xlayerrpc.okx.com | https://testrpc.xlayer.tech/terigon · https://xlayertestrpc.okx.com/terigon |
| Native/gas token | **OKB** | OKB (test) |
| Explorer | https://www.okx.com/web3/explorer/xlayer (also oklink.com/xlayer) | https://www.okx.com/web3/explorer/xlayer-test |
| Faucet | — | OKX X Layer faucet (web3.okx.com/xlayer/faucet; a third-party project doc reports up to 0.2 testnet OKB per claim) |

- Architecture: OP Stack L2 (post-Aug-2025 "PP upgrade": ~1s blocks, up to ~5,000 TPS, AggLayer settlement). EVM-equivalent; standard Foundry/Hardhat/ethers/viem tooling works; viem ships `xLayer`/`xLayerTestnet` chain defs. Multicall3 at the canonical 0xcA11bde05977b3631167028862bE2a173976CA11 on both networks.
- **RPC reachability from this sandbox: VERIFIED 2026-11-25** — `eth_chainId` returned 0xc4 from both mainnet endpoints and 0x7a0 from both testnet endpoints via plain curl. No API key needed for read work.
- DEX note (only if a swap-based concept were chosen): X Layer's liquidity routes mainly through the OKX DEX aggregator; there is no canonical testnet DEX, which is one reason the chosen concept (PLAN.md) does not depend on swaps.

## 5. Testnet vs mainnet for this hackathon

- The brief does **not** require a mainnet deployment and does not mention testnet at all. It requires TapeOut usage **on X Layer** with real addresses — and TapeOut only exists on X Layer **mainnet**. So the TapeOut leg of any serious entry is mainnet by construction; the only question is whether it is read-only (free) or write (needs OKB + wallet).
- Our own original contracts, if any, can be deployed and proven on testnet (1952) with faucet OKB.
