# Robinhood Chain (4663) Token Balances

`wallet.js balance` only prints NATIVE RBH. To see ERC-20 (WETH / USDG / etc.) on
Robinhood chain you must do a raw `eth_call` — the `JsonRpcProvider` class HANGS on
the Robinhood RPC (infinite retry on chainId detect), so never use ethers provider
for balance reads here. Use `fetch` + JSON-RPC directly.

## RPC
```
https://rpc.mainnet.chain.robinhood.com/
```

## Verified token contracts on RBH (found 2026-07-14 from robinscan.io/tokens HTML)
| Token | Contract | Note |
|-------|----------|------|
| **WETH** | `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73` | real WETH on RBH; user held 0.008028 WETH |
| **USDG** | `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` | Global Dollar stablecoin — CONFIRMED (user supplied it 2026-07-14); user held 99.82 USDG |

⚠️ **USDG, NOT USDC.** On RBH the popular stablecoin is **USDG (Global Dollar)**, not
USDC. Don't assume USDC exists — check both the token list and the user's actual holding.

## How to DISCOVER a token address on RBH (when not known)
`robinscan.io` has no public API; the token table is server-rendered HTML. The
symbol text (e.g. `WETH`, `USDG`) appears in the HTML IMMEDIATELY BEFORE its
`href="/token/0x..."` link. Scrape both, keep pairs in order:
```bash
HTML=$(curl -s -m 15 "https://robinscan.io/tokens")
# symbol text shows BEFORE the href; grab both, the address AFTER a symbol is its contract
echo "$HTML" | grep -oE '(WETH|USDG)</a>|href="/token/0x[a-fA-F0-9]{40}"'
```
The first `href="/token/0x..."` AFTER a `USDG</a>` is the USDG contract (confirmed
this way: `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168`). Then verify with a
`symbol()` eth_call (`0x95d89b41`) before trusting it.
Then verify the candidate with a `symbol()` eth_call (`0x95d89b41`) before trusting it.

## Balance read (raw eth_call, no provider class)
```
selector balanceOf: 0x70a08231 + padded address (64 hex)
selector decimals:  0x313ce567
POST {jsonrpc:"2.0",id:1,method:"eth_call",params:[{to:TOKEN,data},"latest"]}
```
Parse `result`: `BigInt(result) / 10n**decimals`. If `result` is `"0x"` or missing →
balance 0 (do NOT `BigInt("0x")` — throws). Use `scripts/rbh_token_balances.js`.

## Result for this user (2026-07-14)
RBH native 0.0112, **WETH 0.008028**, **USDG 99.82**. Total RBH ≈ $137 at ETH~$1875
(USDG dominates ~$100). Contracts saved in `/root/wallet/.env` as `RBH_USDG` /
`RBH_WETH`.
