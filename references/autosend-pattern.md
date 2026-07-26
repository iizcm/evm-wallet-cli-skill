# autosend pattern (auto-send mode, THIS user)

User wants `send` to execute with NO confirmation prompt and ALWAYS return an explorer link.

## The wrapper (`/root/wallet/autosend.js`)
Bypass the `ask()` YES-gate that `wallet.js send` uses. Core loop:

```js
const fs = require('fs');
const env = {};
fs.readFileSync('.env','utf8').split('\n').forEach(l=>{ if(l && !l.startsWith('#')){ const i=l.indexOf('='); env[l.slice(0,i).trim()]=l.slice(i+1).trim(); } });

// Seed parsing: .env has WALLET_SEED (12-word phrase), NOT PRIVATE_KEY.
// `new ethers.Wallet(phrase)` throws `invalid BytesLike` AND leaks the seed in
// the error text (prepend 0x). Use fromPhrase.
let w;
if (env.PRIVATE_KEY) w = new ethers.Wallet(env.PRIVATE_KEY, p);
else w = ethers.Wallet.fromPhrase(env.WALLET_SEED.trim(), p);

const v = ethers.parseEther(amount);
const fee = await p.getFeeData();
const tx = await w.sendTransaction({ to, value: v, maxFeePerGas: fee.maxFeePerGas, maxPriorityFeePerGas: fee.maxPriorityFeePerGas, gasLimit: 60000 });
console.log('HASH', tx.hash);
const rc = await tx.wait();
console.log('CONFIRMED block', rc.blockNumber);
```

Run: `node autosend.js <chainId> <to> <amount>`

## Pitfalls hit this session
- `wallet.js send` has `const y = await ask("Ketik YES...")` then `tx.wait()`. In non-interactive
  SSH the readline hangs, provider closes → `ERR_USE_AFTER_CLOSE`. Fix = separate wrapper with no ask.
- `.env` token read MUST `tr -d "\"' \r\n"` — a trailing `\r` (CRLF from Windows `.env`) breaks
  `git clone https://x-access-token:<TOK>@...` ("bad/illegal format"). Strip CR/LF/quotes when sourcing.
- Verify `ethers.isAddress(to)` before signing. Verify balance ≥ amount+gas before broadcast.

## Explorer links (return in EVERY tx reply)
- Ethereum/Base/Arb/Opt: `https://etherscan.io/tx/<hash>` (swap per chain)
- BSC: `https://bscscan.com/tx/<hash>`
- Polygon: `https://polygonscan.com/tx/<hash>`
- **Robinhood (4663): `https://robinscan.io/tx/<hash>`** (verified HTTP 200; `robinhood-explorer.io` / `explorer.robinhood.com` TIMEOUT — do NOT use those)
