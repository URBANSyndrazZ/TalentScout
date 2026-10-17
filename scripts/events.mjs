// events.mjs —— 汇总链上事件为可提交的交易链接清单（RPC 限制 100 块/次，自动分页）
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JsonRpcProvider, Contract, Interface } from "ethers";
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dep = JSON.parse(fs.readFileSync(path.join(root, "deployments.json"), "utf8"));
const artifact = JSON.parse(fs.readFileSync(path.join(root, "artifacts", "TalentScout.json"), "utf8"));
const provider = new JsonRpcProvider(dep.rpcUrl);
const iface = new Interface(artifact.abi);
const LINK = (h) => dep.explorer + "/tx/" + h;
const from = dep.blockNumber;
const latest = await provider.getBlockNumber();

const all = [];
for (let start = from; start <= latest; start += 100) {
  const end = Math.min(start + 99, latest);
  const logs = await provider.getLogs({ address: dep.contractAddress, fromBlock: start, toBlock: end });
  for (const l of logs) {
    try {
      const p = iface.parseLog(l);
      if (p) all.push({ name: p.name, args: p.args, tx: l.transactionHash, block: l.blockNumber });
    } catch {}
  }
}
console.log("合约:", dep.contractAddress, "· 扫描", from, "→", latest, "· 共", all.length, "条事件\n");
const byType = {};
for (const e of all) (byType[e.name] ??= []).push(e);
const order = ["Published", "Voted", "Tipped", "MessagePosted", "Recommended", "InterestMarked", "Withdrawn"];
for (const name of order) {
  const list = byType[name] ?? [];
  console.log(`── ${name}（${list.length} 条）──`);
  for (const e of list) {
    let extra = "";
    if (name === "Published") extra = `#${e.args[0]} ${e.args[2]}`;
    if (name === "Voted") extra = `#${e.args[0]} → 累计${e.args[2]}票`;
    if (name === "Tipped") extra = `#${e.args[0]} ${Number(e.args[2]) / 1e18} MON`;
    if (name === "MessagePosted") extra = `#${e.args[0]} “${e.args[2]}”`;
    if (name === "Recommended") extra = `#${e.args[0]} ${e.args[1]}票`;
    if (name === "InterestMarked") extra = `#${e.args[0]} 第${e.args[2]}家`;
    console.log(`   ${LINK(e.tx)}  ${extra}`);
  }
  console.log("");
}