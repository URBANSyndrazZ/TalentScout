// wallet-check.mjs <address> —— 查询任意地址在 TalentScout 的余额与交互状态
// 用法: node scripts/wallet-check.mjs 0x...
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JsonRpcProvider, Contract, formatEther } from "ethers";
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dep = JSON.parse(fs.readFileSync(path.join(root, "deployments.json"), "utf8"));
const artifact = JSON.parse(fs.readFileSync(path.join(root, "artifacts", "TalentScout.json"), "utf8"));
const ADDR = process.argv[2];
if (!/^0x[0-9a-fA-F]{40}$/.test(ADDR ?? "")) {
  console.error("用法: node scripts/wallet-check.mjs 0x...");
  process.exit(1);
}
const provider = new JsonRpcProvider(dep.rpcUrl);
const c = new Contract(dep.contractAddress, artifact.abi, provider);
console.log("地址:", ADDR);
console.log("MON 余额:", formatEther(await provider.getBalance(ADDR)));
const [cnt] = await c.getStats();
const voted = [], marked = [];
for (let i = 1; i <= Number(cnt); i++) {
  if (await c.hasVoted(i, ADDR)) voted.push(i);
  if (await c.hasMarked(i, ADDR)) marked.push(i);
}
console.log("已投票卡:", voted.length ? voted.map((x) => "#" + x).join(" ") : "（无）");
console.log("已标记意向卡:", marked.length ? marked.map((x) => "#" + x).join(" ") : "（无）");
console.log("→ 可对 #4 小鹿执行: 投票=" + (!voted.includes(4)) + " · 标记意向=" + (!marked.includes(4)));