// vote-test.mjs —— 通用补票：node scripts/vote-test.mjs <候选id>（用 W1-W4 投票）
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JsonRpcProvider, Wallet, Contract } from "ethers";
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dep = JSON.parse(fs.readFileSync(path.join(root, "deployments.json"), "utf8"));
const artifact = JSON.parse(fs.readFileSync(path.join(root, "artifacts", "TalentScout.json"), "utf8"));
const TARGET = Number(process.argv[2] ?? 3);
const provider = new JsonRpcProvider(dep.rpcUrl);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ws = JSON.parse(fs.readFileSync(path.join(root, ".demo-wallets.json"), "utf8")).wallets.map((k) => new Wallet(k, provider));
const cOf = (w) => new Contract(dep.contractAddress, artifact.abi, w);
console.log("目标卡 #" + TARGET);
for (let i = 0; i < ws.length; i++) {
  const w = ws[i];
  const c = cOf(w);
  if (await c.hasVoted(TARGET, w.address)) { console.log("↩️ W" + (i + 1) + " 已投过"); continue; }
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const tx = await c.vote(TARGET, { gasLimit: 200_000n });
      await tx.wait();
      console.log("✅ W" + (i + 1) + " 投 #" + TARGET + " ·", dep.explorer + "/tx/" + tx.hash);
      await sleep(6000);
      break;
    } catch (e) { console.log("⚠️ W" + (i + 1), (e.shortMessage ?? e.message).slice(0, 70)); await sleep(6000); }
  }
}
const x = await cOf(ws[0]).getCandidate(TARGET);
console.log("📊 #" + TARGET + " 票数 =", x.votes.toString(), "· 入池 =", x.recommended);