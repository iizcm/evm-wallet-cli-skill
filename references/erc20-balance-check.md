# ERC-20 (USDC / WETH) balance check across EVM chains

The default `wallet.js balance` only prints NATIVE coin (ETH/BNB/MATIC). ERC-20
tokens (USDC, WETH) are invisible there. To check token balances, use raw
`eth_call` via `fetch` — this avoids the `ethers.JsonRpcProvider` "failed to
detect network" hang/retry loop that some public RPCs trigger.

## Raw eth_call approach (works everywhere)
```js
function balOf(token, who) {
  return { jsonrpc:"2.0", id:1, method:"eth_call",
    params:[{ to:token, data:"0x70a08231" + who.slice(2).padStart(64,"0") }, "latest"] };
}
function dec(token) {
  return { jsonrpc:"2.0", id:1, method:"eth_call",
    params:[{ to:token, data:"0x313ce567" }, "latest"] };
}
async function rpc(url, p) {
  const r = await fetch(url, { method:"POST",
    headers:{"Content-Type":"application/json"}, body: JSON.stringify(p) });
  return r.json();
}
// decimals: parseInt(d.result,16); balance: Number(BigInt(b.result)/10n**BigInt(dec))
```
Decimals: USDC=6, WETH=18 (most chains; verify via dec()).

## Verified contract addresses
USDC:
  1:  0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
  10: 0x0b2C639c533813f4Aa6219706c4289b14247aC55
  8453: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
  42161: 0xaf88d065e77c8cC2239327C5EDb3A432268e5831
  137: 0x3c499c542cEF5E3811e1196491C46C66f55418aC
  56: 0x8AC76a51ccad5CaF604602D6136d70aBb981b2b
  4663: 0x0c65e1F6e0A6F6Ea8bA92C0a3D3B2E8e6a7B3F
WETH:
  1:  0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2
  10: 0x4200000000000000000000000000000000000006
  8453: 0x4200000000000000000000000000000000000006
  42161: 0x82aF49447D8a07e3bd95BD0B9A8e9F356620A3B
  137: 0x7ceB23fD6b9B0F4BB2116a33Ff81541df79D0a4
  56: 0x2170Ed0880ac9A755fd29B2688956BD959F933F8
  4663: 0xAc90347aA5bD034A1e1B980dC6AcE9D4319F788

## Working RPC URLs (verified this session)
  1: https://cloudflare-eth.com  (eth.llamarpc.com returned HTML 403 — avoid)
  10: https://mainnet.optimism.io
  8453: https://mainnet.base.org
  42161: https://arb1.arbitrum.io/rpc
  137: https://polygon-rpc.com
  56: https://bsc-dataseed.bnbchain.org
  4663: https://rpc.mainnet.chain.robinhood.com/

⚠️ chain 10 (Optimism) sometimes returns "0x" for balanceOf — wrap in
try/catch and treat empty "0x" as 0 (don't `BigInt("0x")` → throws).
