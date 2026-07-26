---
name: evm-wallet-cli
description: Build and operate a self-custodial EVM wallet CLI (ethers v6) for NFT minting, send, trading, and bridging — chat-driven, confirmation-gated, HD child wallets. Use when the user wants to manage crypto wallets, mint NFTs from multiple wallets, fund burner wallets, or do transactions via chat.
---

# EVM Wallet CLI (ethers v6)

Non-custodial wallet tooling for EVM chains, driven by chat. Core principle: **the agent never holds the keys in its own memory/context**.

## User confirmation policy (THIS USER — non-negotiable, overrides generic rule)
- **This user runs AUTO-SEND mode (Model B = YES, no per-tx prompt).** They explicitly said: *"langsung send aja tanpa ada msg lainnya... setiap gua suruh send berapapun lu langsung eksekusi"*.
- `send` commands execute IMMEDIATELY — no `readline` YES gate, no draft-and-wait. Build an `autosend.js` wrapper (see `references/autosend-pattern.md`) that skips the `ask()` prompt entirely.
- **ALWAYS return the explorer link** in the reply (user: *"kedepannya link tx nya pake link juga direct ke explorer"*). RBH(4663) → `https://robinscan.io/tx/<hash>`. See `references/autosend-pattern.md` for the no-prompt wrapper + explorer list.
- **ALWAYS show USD next to any native balance / tx cost (THIS USER — non-negotiable).** User explicitly corrected: *"mahal amat berapa itu diconvert ke dollar. biasakan kalo nulis eth rbh itu pake cv ke $ juga"*. Rule: every time you print a balance, gas estimate, or mint cost in ETH/RBH/WETH/etc, ALSO print the USD equivalent. Pull ETH price from `https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd` (RBH tracks ETH ~1:1 as L2-ish native; if unsure of RBH USD peg, say so and use ETH price as proxy). Format: `0.000008 RBH (~$0.00)` or `0.057 RBH (~$X @ $Y/ETH)`. Never report native-only.
- **RBH native = ETH (THIS USER clarified).** Robinhood Chain (4663) uses plain **ETH** as native (like OP/Base/Arbitrum). There is NO "RBH token" — "RBH" is just the network name. Fund = send ETH on network 4663. Don't hunt for an RBH ERC-20.

- Safety that still applies: keep an address allowlist + amount sanity check in code, verify balance ≥ amount+gas BEFORE broadcast, and never sign if destination fails `isAddress`. Do NOT block on a human YES.
- The generic skill default is confirmation-gated; for THIS user auto-send is the accepted model — do not re-ask.


## When to use
- "Mint NFT from multiple wallets", "create burner wallet and fund it", "send/trade/bridge via chat", "set primary wallet".
- Building a `wallet.js`-style CLI on Node + ethers for an EVM user.

## Security rules (NON-NEGOTIABLE)
- NEVER store seed phrase / mnemonic / private key in agent memory, session notes, or in any log you persist. Read it only from a local `.env` the user fills in themselves.
- Every tx = draft → print details → `readline` ask → must type `YES` (case-insensitive) to sign+broadcast. NO auto-sign, ever.
- For "full access / auto tx / just chat to transact" requests, counter with **allowlist + per-tx YES** (this user explicitly wanted "chat-only tx" — accepted model B with manual confirm, declined unrestricted auto-sign). Auto-exec without confirmation = irreversible loss risk (typo address, prompt injection from web pages the agent reads). Store allowlisted addresses + per-tx amount caps in code/config, but never the key.
- If a seed was ever pasted into chat or printed in terminal output, warn the user it is **compromised** — advise moving funds off it. Treat as burner only. (Real incident this session: a `0x`-prefixed mnemonic was passed to `new ethers.Wallet`, printing the seed; that wallet must be abandoned.)
- Keep `.env` and `wallets.json` OUT of any git repo / commit.
- **VPS seller CAN see data (THIS USER — flagged this session).** When the VPS is a **rented/seller VPS** (e.g. RackNerd), the host has root on the node and can read disk/RAM. **Do NOT store private keys / mnemonics in plaintext on a seller VPS if the user cares about that wallet.** Safer options, in order: (1) user mints manually from their own browser/hardware wallet; (2) generate a burner wallet ON the VPS, fund it, mint from it, and treat it as disposable; (3) if PK must live on VPS, the user accepts the risk. **Never tell the user a seller VPS is "safe" for keys.** This user's standing rule: *"biasakan kalo buat wallet lu backup ke github (private) biar ngga ilang"* → when you GENERATE a new wallet, back up its **address + label + chain** to the PRIVATE GitHub repo (`iizcm/hermes-tasks`); **NEVER back up the private key or seed** (only the address, so funds aren't lost-track-of). Restore = re-derive from seed the user holds.

## ethers v6 pitfalls (verified the hard way)
See `references/ethers-v6-pitfalls.md`:
- `new ethers.Wallet(mnemonicString)` → throws `invalid BytesLike` (expects hex private key, not words). Use `ethers.Wallet.fromPhrase(mnemonic)`.
- ⚠️ **SEED LEAK via error message (bitten, real loss risk):** when you call `new ethers.Wallet("12-word mnemonic")`, ethers parses it as a hex key, throws `invalid BytesLike value`, and **prepends `0x` to the mnemonic in the error text — PRINTING THE FULL SEED to terminal/log**. Always detect mnemonic (≥12 whitespace-separated words) and route to `fromPhrase`; else `new ethers.Wallet(hexKey)`. If this ever fires, tell the user the wallet is **compromised**, move funds out, never reuse it.
- `HDNodeWallet.fromPhrase(seed, undefined, path)` **ignores the path** → always returns root = primary address. Derive via `fromSeed(...).derivePath(...)` instead.
- `Mnemonic.fromPhrase(seed).computeSeed()` returns a **hex string** (`0x…`) — pass straight to `fromSeed`.
- Offset child index by `+1` so child #0 ≠ primary (avoids confusing overlap where mint1 address == primary).
- **`JsonRpcProvider(rpc)` with NO network hint hangs/retries forever on some public RPCs** (e.g. Base thirdweb, Robinhood) — `balances()`/`send()` time out at 110s+ with no error. FIX: pass `staticNetwork` so ethers skips chainId auto-detection:
  `new ethers.JsonRpcProvider(rpc, { chainId: Number(id), name: c.name }, { staticNetwork: true })`.
  Wrap provider creation in a `prov(id)` helper used by both `balances()` and `send()`.
- **Checking ERC-20 (USDC/WETH) balances:** `wallet.js balance` only prints NATIVE coin. Use raw `eth_call` via `fetch` (see `references/erc20-balance-check.md` for addresses + working RPCs + snippet). This avoids the JsonRpcProvider hang entirely. Gotchas: Optimism(10) sometimes returns `"0x"` for `balanceOf` → treat as 0 (do NOT `BigInt("0x")`, throws). `eth.llamarpc.com` returns HTML 403 for ETH mainnet → use `cloudflare-eth.com`. **Robinhood (4663) token specifics** — real WETH contract `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73`, USDG stablecoin (NOT USDC), and the `robinscan.io/tokens` HTML-scrape trick to discover unknown token addresses — are in `references/rbh-token-balances.md`; run `scripts/rbh_token_balances.js`.
- **OpenSea Agent Tools marketplace** (`opensea.io/tools`, Beta): catalog of 3rd-party callable AI-agent tools across categories (Trading 3k, AI Agents 2.7k, Payments, DeFi, Data, **NFT 476**, Social, Gaming, Identity, Dev Tools). Most charge via x402 in **USDC**. NFT-relevant picks: *NFT Floor Price* + *Wallet NFT Holdings* (402.com.tr, <$0.01), *Aura NFT order audit*, *RelayShield nft security* ($0.10), *Token rug-risk*. To USE them you need an "onchain agent" + USDC (this user holds USDG, not USDC — mismatch). Practical shortcut for a non-agent user: read the tool's host and call its public API directly instead of wiring an agent.

## Multi-chain RPC
Alchemy key must be valid **per network** (one bad/missing key → 403 on that chain only; others still work). Public RPCs frequently **region-block** (e.g. Indonesia IP → Base / llamarpc / drpc all 403). See `references/multi-chain-rpc.md` for working public fallbacks + the `alchemy-or-public` toggle pattern (use alchemy if key set, else public endpoint).

## Minimal structure (`wallet.js`)
- Load `.env`: `WALLET_SEED`, `ALCHEMY_KEY`, `CHAIN_IDS` (e.g. `1,8453,56,137,42161,10`).
- `CHAINS` map per chainId: `{ name, sym, alc, pub }` where `alc` = Alchemy URL or null, `pub` = public RPC fallback. Default active chains include **Robinhood (4663)** with public RPC `https://rpc.mainnet.chain.robinhood.com/` (works from VPS/RackNerd even though region-blocked from Indonesia). Explorer for 4663: `https://robinscan.io/tx/<hash>` (verified 200). 4663 is a FIRST-CLASS chain here, not removed.
- `primary = ethers.Wallet.fromPhrase(seed).address`
- `newWallet(label)` → `HDNodeWallet.fromSeed(Mnemonic.fromPhrase(seed).computeSeed()).derivePath("m/44'/60'/0'/0/"+(idx+1))` → push to `wallets.json`.
- `fund(chain, idx, amt)` → looks up child address → calls `send(...)`.
- `send(chain, to, amt, token)` → draft native or ERC20 → ask YES → `sendTransaction` / `transfer`.
- `balances()` → loop active chains, `getBalance`.
- CLI: `balance` | `send <chain> <to> <amt> <native|erc20addr>` | `newwallet [label]` | `fund <chain> <idx> <amt>`.

## Verify (no test suite for a CLI — ad-hoc only)
- `node --check wallet.js` (syntax).
- `node wallet.js newwallet test` (offline) → assert child address ≠ primary.
- `node wallet.js balance` (live RPC) → confirms chain connectivity.
- **Env loading gotcha**: `const env = { ...process.env }` THEN overlay `.env` file. If you
  read `.env` into a fresh `{}` only, shell flags like `AUTO_YES=1` are invisible to the script.
- **Non-interactive E2E test**: `AUTO_YES=1 node wallet.js fund 1 0 0.00001` → expect
  `CONFIRMED in block N`. Then assert primary balance dropped by ~value+gas (no explorer needed).
  Never pipe `echo YES |` — it closes stdin and throws `ERR_USE_AFTER_CLOSE`; `AUTO_YES` is the
  correct test path. See `references/ethers-v6-pitfalls.md` (BigInt gas + readline section).
- **Mint when the ABI/selector is unknown (verified this session — RBH freemint):** if `eth_estimateGas` reverts on guessed selectors (`0x1249c58b` etc), DON'T guess. Replay a known-good tx: (1) find a recent successful mint via `eth_getLogs` on `Transfer` topic `0xddf252ad...b3ef` from `0x0...0` (mint = from=zero); take its `transactionHash`; (2) `eth_getTransactionByHash` → copy the raw `input` (selector + args); (3) sign+send that EXACT `data` from the user's wallet (value 0 for freemint). This reuses a proven calldata shape. Gotcha: the raw input may embed a `to`/projectId/salt arg — leave it intact (don't substitute the recipient there; the minter is `msg.sender` = the signing wallet). Verify `estimateGas` succeeds before broadcast. RBH gas is cheap (~0.067 gwei → a mint costs ~0.000006 RBH, ~$0.00). THIS USER wants cost shown in USD too (see above).
- **⚠️ REPLAY REVERT PITFALL (bitten hard this session):** copying a random successful mint tx and replaying it from ANOTHER wallet reverts (status 0, CALL_EXCEPTION). Root cause: the calldata embedded a **salt/projectId/allowlist index** tied to the ORIGINAL minter. The agent copied tx `0x76fb…` thinking it was "the user's mint" but its `from` was `0xe266…` (NOT the user `0x732c…`). **Always verify `from` == user's address** before treating a tx as the template. Correct flow when ABI unknown: have the user mint 1 MANUALLY from their own wallet first, then `eth_getTransactionByHash` on THAT tx → replay its `input` (the minter is `msg.sender`, so the same calldata works for any wallet as long as it has no wallet-specific salt). If replay still reverts → STOP and ask for the mint function ABI.
- **⚠️ SEADROP `mintSigned` = SIGNATURE-BOUND (the actual cause of the replay failure this session, distinct from salt):** if the mint tx `to` = `0x00005EA0...` (OpenSea SeaDrop) with selector `0x4b61cd6f` and a trailing signature blob, the calldata is **server-signed per-wallet** and CANNOT be replayed to other wallets. Scripted sybil mint on a SeaDrop drop requires browser automation (per-wallet signature) or adding subs to the drop's allowlist. Full detail + correct paths in `references/sybil-mint.md`. **Execution rule: when the user says "sudah public mint", the drop is OPEN — go straight to the real entry point (SeaDrop UI / browser automation), do NOT loop guessing `mint()` selectors. Over-analyzing a live drop = user rage ("goblok", "keburu sold out").**
- **Sybil / burner-wallet mint infra** (inflate mint count with N generated wallets funded from 1 primary): see `references/sybil-mint.md` — generator, funder, gas math, CSV-label bug, and the replay-revert gotcha above.
- Broadcast/send is ONLY verifiable with real funds + a real YES; if untested, say so explicitly. Never claim "fully verified" when broadcast path is unexercised.
