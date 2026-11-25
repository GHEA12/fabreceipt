# FabReceipt — a living receipt for every TapeOut processor on X Layer

TapeOut's X Layer ecosystem has hundreds of processors and thousands of etched
circuits, real OKB changing hands for transistors, and upgradeable protocol
contracts whose implementation has already changed silently at least once. Yet
a buyer cannot answer basic questions before spending: Is this processor real
and active, or one of the hundred-plus that never fabricated anything? What
does it charge per transistor — and did that price just change? Did the code
behind it get upgraded last night?

**FabReceipt reads TapeOut's factory, market and processor contracts directly
from X Layer mainnet** — no indexer, no API key, no wallet — keeps block-pinned
snapshots, and turns them into a public receipt per processor:

- **Identity** — processor address, name, creator, and the exact implementation
  its beacon proxy currently runs.
- **Economics** — transistor mint price, transistors minted vs supply cap,
  sold-out and free-mint flags.
- **Production** — circuits etched, and its share of all TapeOut production.
- **Change log** — a diff engine compares snapshots and flags implementation
  upgrades, price moves, first etches, sellouts and new processors. Snapshot
  hashes are anchored on-chain (ReceiptAnchor, X Layer testnet) so the history
  itself is tamper-evident.

## Live census (X Layer mainnet block 76,813,166 — 25 Nov 2026)

- **449 processors** registered in the TapeOut CPU factory (independently
  reproducing and extending the October 2026 community census of 389).
- **12,202 circuits etched**; production is concentrated (top processor
  FAB-Genisis alone: 7,160).
- **117 processors have never etched a circuit**; 52 are sold out of
  transistors; 66 mint transistors for free.
- Every processor is a 295-byte beacon proxy on one shared circuit beacon —
  a single beacon upgrade would change all of them at once. FabReceipt watches
  exactly that slot, plus the factory/market UUPS implementations.

Full snapshot: [`data/census-76813166.json`](data/census-76813166.json).
Protocol-level diff vs the earlier integrity snapshot:
[`data/diff-76812763-76813166.txt`](data/diff-76812763-76813166.txt).

## Run it

```bash
npm install
node scanner/scan.js          # Phase A: factory/market integrity snapshot
node scanner/census.js        # Phase B: full processor census at a pinned block
node scanner/diff.js data/<older>.json data/<newer>.json
node contracts/compile.js     # build ReceiptAnchor
node contracts/deploy-testnet.js   # deploy + anchor on X Layer testnet (needs faucet OKB)
```

Open `dashboard/index.html` (with `snapshot-latest.json` and `diff-latest.json`
beside it, as written by the scanner) for the receipt browser: searchable
processor list, per-processor receipt pages, protocol cards and the change log.

## How the contracts were read

TapeOut's factory/market are not source-verified. The ABIs were
reverse-engineered read-only — proxy/implementation resolution, bytecode
selector extraction, signature-database resolution, and on-chain confirmation
of every read. Method and findings: [`scanner/ABI.md`](scanner/ABI.md).
Key addresses (X Layer mainnet, chain 196):

| Contract | Address |
| --- | --- |
| TapeOut CPU factory | `0x1f09daefa827f02cbb40967cc91b259763760761` |
| TapeOut market | `0xd89f358c48a7B632c9845af2a02A32eB90DD75DB` |
| Circuit beacon (all processors) | `0xf70d1ed4f62CF3780157B0b421b7E2F45bD0991C` |
| Transistor beacon | `0x1059Ad62cAbB6a6925bb65aA617300556c60A51B` |
| BEM token (X Layer) | `0x60e62Efa9405d6873C5deaBD4E6CC91c25363952` |

## Status

Built for the OKX X Layer **TapeOut Accelerate** hackathon (deadline
7 Dec 2026, 23:59 UTC). See `PLAN.md` for the build checklist and `EVIDENCE.md`
for the on-chain proof trail. The mainnet side is read-only by design;
ReceiptAnchor deploys to X Layer testnet (1952) with faucet funds.
