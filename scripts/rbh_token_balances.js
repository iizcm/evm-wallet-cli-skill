// rbh_token_balances.js — check ERC-20 balances on Robinhood chain (4663).
// Uses raw eth_call (no ethers JsonRpcProvider — it hangs on RBH RPC).
// Usage: node scripts/rbh_token_balances.js   (reads WALLET_SEED from /root/wallet/.env)
const fs = require("fs");
const env = {};
fs.readFileSync("/root/wallet/.env", "utf8").split("\n").forEach(l => {
  if (l.includes("=")) { const [k, v] = l.split("="); env[k.trim()] = v.trim(); }
});
const { ethers } = require("ethers");
const addr = ethers.Wallet.fromPhrase(env.WALLET_SEED).address;
const RPC = "https://rpc.mainnet.chain.robinhood.com/";
// Edit this list to add tokens. Verified RBH contracts:
const TOKENS = [
  ["WETH", "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73"],
  ["USDG#1", "0xc6911796042b15d7Fa4F6CDe69e245DdCd3d9c31"],
  ["USDG#2", "0x241F3Caad03Db31137F641beF005A32176530024"],
];
const BAL = "0x70a08231";
const DEC = "0x313ce567";
const pad = a => a.slice(2).padStart(64, "0");
async function rpc(to, data) {
  const r = await fetch(RPC, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to, data }, "latest"] }) });
  return (await r.json()).result;
}
async function balOf(t) {
  const d = await rpc(t, DEC); const dec = parseInt(d, 16) || 18;
  const b = await rpc(t, BAL + pad(addr));
  if (!b) return 0;
  return Number(BigInt(b)) / Number(10n ** BigInt(dec));
}
(async () => {
  console.log("Robinhood(4663) token balances for", addr);
  for (const [name, t] of TOKENS) {
    try { console.log(name, t, "bal:", await balOf(t)); }
    catch (e) { console.log(name, t, "ERR", e.message.slice(0, 30)); }
  }
})();
