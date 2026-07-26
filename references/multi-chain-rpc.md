# Multi-chain RPC (public fallbacks + region-blocking)

Verified 2026-07 on a Windows/MSYS box behind an Indonesia IP. Alchemy key was
invalid for 5/6 chains (403); public RPCs used instead.

## Alchemy quirk
- One Alchemy app key is per-network. A valid ETH key does NOT authorize Base/BSC/etc.
  Bad/missing key → 403 on that chain only; others still work.
- Pattern: `rpc: process.env.ALCHEMY_KEY ? \`https://<chain>-mainnet.g.alchemy.com/v2/${key}\` : "<public>"`

## Public RPCs that WORKED (Indonesia IP)
- Ethereum:  https://eth.llamarpc.com
- BSC:       https://bsc-dataseed.bnbchain.org
- Polygon:   https://polygon-bor-rpc.publicnode.com
- Arbitrum:  https://arb1.arbitrum.io/rpc
- Optimism:  https://mainnet.optimism.io

## Public RPCs that 403'd (region-block, Indonesia IP)
- Base:  mainnet.base.org, base.llamarpc.com, base.drpc.org, 1rpc.io/base, base.meowrpc.com
  → ALL 403. Base needs Alchemy key or a region-open RPC.
- Polygon: polygon-rpc.com (401, needs key), rpc.ankr.com/polygon (timeout)

## Lesson
If a chain 403s on every public RPC, assume region-blocking, not a code bug.
Fall back to a paid/region RPC or a correct Alchemy app for that specific chain.

## `staticNetwork` is mandatory for flaky public RPCs
`new ethers.JsonRpcProvider(rpc)` auto-detects the chain by calling `eth_chainId`.
Some public endpoints ignore/hang that call → ethers retries forever (110s+ timeout,
no error surfaced). Always pass `staticNetwork`:
```js
function prov(id){ const c = CHAINS[id];
  return new ethers.JsonRpcProvider(c.rpc, { chainId:Number(id), name:c.name }, { staticNetwork:true }); }
```
Use `prov(id)` in BOTH `balances()` and `send()`. Without it, Base thirdweb / Robinhood
just hang the whole `balances()` loop.

## Robinhood chain (CORRECTED: chainId **4663**, NOT 9889)
- chainId **4663** (hex 0x1237), sym ETH. 9889 was WRONG — never use it.
- Official HTTPS RPC (ChainList): `https://robinhood.drpc.org` (WSS: wss://robinhood.drpc.org).
  Valid + responds, BUT drpc **free tier does NOT support Robinhood** →
  `code 35: chain is not available on freetier, please upgrade to paid tier`.
- NO free public RPC for 4663 (thirdweb `4663.rpc.thirdweb.com` → "Invalid chain";
  others EMPTY/403). User accepted FREE-ONLY setup.
- Resolution (2026-07): Robinhood REMOVED from `CHAIN_IDS` default (now `1,8453,56,137,42161,10`).
  Keep `CHAINS[4663]` hook: `4663: { name:'Robinhood', sym:'ETH', alc:null, pub: process.env.ROBINHOOD_RPC || 'https://robinhood.drpc.org' }`.
  Do NOT add 4663 to CHAIN_IDS default until a free RPC exists.

## Base (8453) — WORKING public RPC found (2026-07, corrected)
- `https://base.lava.build` is the ONE public Base RPC that returned 200 AND worked
  through ethers from this Indonesia IP (verified live: block ~48.5M, balance read OK).
  Wire Base to lava.build as the default public endpoint.
- Still 403 from this region: mainnet.base.org, base.llamarpc.com, base.drpc.org,
  1rpc.io/base, base.meowrpc.com, base.api.onfinality.io/public, base.rpc.thirdweb.com.
- Consequence: Base does NOT require Alchemy here — lava.build suffices.

## Async alchemy→public `prov()` (the fix that got 6/7 chains live)
ethers `JsonRpcProvider` with no network hint retries forever on flaky RPCs, and a
bad/partial Alchemy key 403s some chains. Combine `staticNetwork` + a 4s race probe
so a dead/false Alchemy key falls back to public fast — without hanging the loop:
```js
async function prov(id) {
  const c = CHAINS[id];
  if (c.alc) {
    try {
      const pa = new ethers.JsonRpcProvider(c.alc, { chainId: Number(id), name: c.name }, { staticNetwork: true });
      await Promise.race([pa.getBlockNumber(), new Promise((_, r) => setTimeout(() => r(new Error("to")), 4000))]);
      return pa;
    } catch { /* fall through to public */ }
  }
  return new ethers.JsonRpcProvider(c.pub, { chainId: Number(id), name: c.name }, { staticNetwork: true });
}
```
`CHAINS[id]` carries `{ name, sym, alc, pub }` (alc = Alchemy URL or null, pub = public).
Both `balances()` and `send()` must `await prov(id)`. This got 6/7 chains live
(ETH, Base, BSC, Polygon, Arbitrum, Optimism); only Robinhood stayed pending its RPC.
