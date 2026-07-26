# ethers v6 pitfalls (verified)

All reproduced on ethers 6.17.0 (Node 22, Windows MSYS terminal).

## Mnemonic vs private key
- `new ethers.Wallet(mnemonicString)` → throws `invalid BytesLike value` (expects a hex private key, not words).
  ✅ Use `ethers.Wallet.fromPhrase(mnemonic)`.
- ⚠️ SEED LEAK via error message (real incident 2026-07): when `new ethers.Wallet("12-word mnemonic")` throws,
  ethers PREPENDS `0x` to the mnemonic inside the error text, printing the FULL SEED to terminal/log.
  A user actually triggered this (passed a 0x-prefixed mnemonic) and the seed was exposed in output.
  Always detect mnemonic (>=12 whitespace-separated words) and route to fromPhrase; else use new ethers.Wallet(hexKey).
  If a seed ever prints, warn the user the wallet is COMPROMISED — move funds out, never reuse it.
  The CLI should guard the error path so the raw seed is never echoed on failure.

## HD derivation path is ignored by fromPhrase
- `HDNodeWallet.fromPhrase(seed, undefined, "m/44'/60'/0'/0/0")` returns the ROOT address
  (== primary), not the derived child. The path argument is silently ignored.
  ✅ Derive properly:
  ```js
  const seedHex = ethers.Mnemonic.fromPhrase(seed.trim()).computeSeed(); // returns "0x..." string
  const hd = ethers.HDNodeWallet.fromSeed(seedHex);
  const child = hd.derivePath(`m/44'/60'/0'/0/${idx + 1}`); // +1 so #0 != primary
  ```

## computeSeed() return type
- `Mnemonic.fromPhrase(seed).computeSeed()` returns a **hex string** (`"0x3280..."`), not a Uint8Array.
  Pass it straight to `fromSeed(seedHex)` — do NOT re-hex/decode it.

## ERC20 transfer typing
- `new ethers.Contract(token, ["function transfer(address,uint256)"], wallet)` then `.transfer(to, parsedAmount)`.
- Need `decimals()` + `symbol()` from a minimal ABI for human-readable amounts.

## BigInt gas math (ethers v6)
- `ethers.parseUnits("60000",0).mul(maxFee)` THROWS `mul is not a function` — parseUnits
  returns a **bigint**, not a BigNumber. Use `60000n * maxFee` (both bigint).
- `getFeeData()` → `const maxFee = fee.maxFeePerGas || fee.gasPrice || 1n; const gasCost = 60000n * maxFee;`

## readline confirm gate + `AUTO_YES` test pattern
```js
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise(r => { if (process.env.AUTO_YES) return r("YES"); rl.question(q, r); });
const y = await ask("Type YES to sign & broadcast: ");
if (y.trim().toUpperCase() !== "YES") { console.log("CANCELLED"); return; }
```
- Always print from/to/value/gas BEFORE asking. Never auto-sign.
- **`env` MUST merge `process.env`** so `AUTO_YES=1 node wallet.js ...` is seen:
  `const env = { ...process.env };` then overlay the parsed `.env` file. Reading only the
  `.env` file (as a plain `{}`) silently ignores shell `AUTO_YES=1` and the prompt never fires.
- **`ERR_USE_AFTER_CLOSE`**: `rl.close()` in a `finally` while an `await ask(...)` is still
  pending throws `readline was closed`. Do NOT pipe `echo YES |` either (closes stdin → same
  error). For non-interactive TEST runs use `AUTO_YES=1`, never pipe input.
- Real broadcast verified with `AUTO_YES=1 node wallet.js fund 1 0 0.00001` → expect
  `CONFIRMED in block N`, and confirm primary balance dropped by ~value+gas.
