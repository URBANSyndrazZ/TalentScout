// 把链上全部状态导出成前端可用的静态快照（frontend/fallback.json）
// 运行: npm run snapshot
//
// 为什么需要它：现场最大的不确定性是网络。RPC 一旦连不上，前端就一片空白，
// 而这正是台上最不能发生的事。有了快照，前端会在读不到链时自动降级渲染，
// 并明确标注"这是 XX 时刻的链上快照"，网络恢复后自动切回实时数据。
import { JsonRpcProvider, Contract, Interface } from "ethers";
import fs from "node:fs";
import path from "node:path";
import { ROOT, DEPLOYMENTS, readJson, readArtifact } from "./write-config.mjs";

const RPC_URL = process.env.RPC_URL ?? "https://testnet-rpc.monad.xyz";
const dep = readJson(DEPLOYMENTS);

const provider = new JsonRpcProvider(RPC_URL);
const scout = new Contract(dep.contractAddress, readArtifact("TalentScout").abi, provider);
const registry = dep.profileRegistry?.address
  ? new Contract(dep.profileRegistry.address, readArtifact("ProfileRegistry").abi, provider)
  : null;

const [countRaw, thresholdRaw] = await scout.getStats();
const count = Number(countRaw);
const blockNumber = await provider.getBlockNumber();

const candidates = [];
const messages = {};
const profiles = {};

for (let id = 1; id <= count; id++) {
  const c = await scout.getCandidate(id);
  candidates.push({
    id,
    owner: c.owner,
    name: c.name,
    tagline: c.tagline,
    skills: c.skills,
    links: c.links,
    theme: Number(c.theme),
    votes: Number(c.votes),
    tips: c.tips.toString(),          // BigInt 不能进 JSON，转字符串
    msgCount: Number(c.msgCount),
    interestCount: Number(c.interestCount),
    recommended: c.recommended,
  });
  try { messages[id] = await scout.getMessages(id); } catch { messages[id] = []; }
  if (registry) {
    try {
      const p = await registry.getProfile(id);
      if (p.contentHash && p.contentHash !== "0x" + "0".repeat(64)) {
        profiles[id] = { hash: p.contentHash, json: p.json, updatedAt: Number(p.updatedAt), version: Number(p.version) };
      }
    } catch {}
  }
}

/* ── 扫 MessagePosted 事件：合约只存了留言文本，留言人地址与交易哈希只在事件里 ──
   公共 RPC 限 100 块/次，按 100 分页 + 8 路并发。 */
console.log("🔎 扫描 MessagePosted 事件（留言来源地址 + 交易哈希）…");
const iface = new Interface(readArtifact("TalentScout").abi);
const ranges = [];
for (let start = Number(dep.blockNumber ?? 0); start <= blockNumber; start += 100) {
  ranges.push([start, Math.min(start + 99, blockNumber)]);
}

const rawMeta = {};
const rawInterest = {};    // cardId → [{company, tx, block}]  —— "标记意向"的地址与交易
const rawRecommended = {}; // cardId → {tx, block, votes}          —— 入池时刻
let incomplete = false;

for (let i = 0; i < ranges.length; i += 8) {
  const batch = ranges.slice(i, i + 8);
  const results = await Promise.all(batch.map(async ([from, to]) => {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try { return await provider.getLogs({ address: dep.contractAddress, fromBlock: from, toBlock: to }); }
      catch (e) { if (attempt === 2) { console.log(`   ⚠️ ${from}-${to} 拉取失败：${e.shortMessage ?? e.message}`); return null; } }
    }
  }));
  for (const logs of results) {
    if (logs === null) { incomplete = true; continue; }
    for (const l of logs) {
      try {
        const p = iface.parseLog(l);
        if (p?.name === "MessagePosted") {
          const id = Number(p.args[0]);
          (rawMeta[id] ??= []).push({ text: p.args[2], from: p.args[1], tx: l.transactionHash, block: l.blockNumber });
        } else if (p?.name === "InterestMarked") {
          // 合约只存了计数，**"是哪家企业"只在事件里**——和留言墙同一个问题、同一个解法
          const id = Number(p.args[0]);
          (rawInterest[id] ??= []).push({ company: p.args[1], tx: l.transactionHash, block: l.blockNumber });
        } else if (p?.name === "Recommended") {
          const id = Number(p.args[0]);
          if (!rawRecommended[id]) rawRecommended[id] = { tx: l.transactionHash, block: l.blockNumber, votes: Number(p.args[1]) };
        }
      } catch {}
    }
  }
}

// 完整性自检：事件条数必须与 getMessages() 的长度逐卡对上，否则下标会错位（宁可不显示作者）
const messageMeta = {};
for (const [idStr, list] of Object.entries(rawMeta)) {
  const id = Number(idStr);
  if (list.length === (messages[id] ?? []).length) messageMeta[id] = list;
  else { incomplete = true; console.log(`   ⚠️ #${id} 事件 ${list.length} 条 ≠ 链上留言 ${(messages[id] ?? []).length} 条，本卡不标作者`); }
}
console.log(`   ${Object.keys(messageMeta).length} 张卡对齐成功 · 共 ${Object.values(messageMeta).reduce((s, l) => s + l.length, 0)} 条留言${incomplete ? "（有部分未对齐）" : ""}`);

// 意向标记同样做完整性自检（事件条数必须与 interestCount 一致，否则下标/归属会错）
const interestMeta = {};
for (const c of candidates) {
  const list = rawInterest[c.id] ?? [];
  if (list.length === c.interestCount) { if (list.length) interestMeta[c.id] = list; }
  else { incomplete = true; console.log(`   ⚠️ #${c.id} 意向事件 ${list.length} 条 ≠ 链上计数 ${c.interestCount}，本卡不标企业地址`); }
}
const recommendedAt = {};
for (const c of candidates) {
  const r = rawRecommended[c.id];
  if (c.recommended && r) recommendedAt[c.id] = r;
}
console.log(`   ${Object.keys(interestMeta).length} 张卡的意向企业已对齐（共 ${Object.values(interestMeta).reduce((s, l) => s + l.length, 0)} 条）· ${Object.keys(recommendedAt).length} 张卡有入池时刻`);

const out = {
  savedAt: new Date().toISOString(),
  blockNumber,
  chainId: dep.chainId,
  contractAddress: dep.contractAddress,
  profileAddress: dep.profileRegistry?.address ?? null,
  threshold: Number(thresholdRaw),
  candidates,
  messages,
  messageMeta,     // 留言文本 ↔ 作者地址/交易哈希（按数组下标对齐）
  interestMeta,    // 卡片 ↔ 标记过意向的企业地址/交易哈希
  recommendedAt,   // 卡片 ↔ 入池那一刻的交易与区块
  profiles,
};

const outFile = path.join(ROOT, "frontend", "fallback.json");
fs.writeFileSync(outFile, JSON.stringify(out, null, 2));

const totalVotes = candidates.reduce((s, c) => s + c.votes, 0);
const totalTips = candidates.reduce((s, c) => BigInt(c.tips), 0n);
const inPool = candidates.filter((c) => c.recommended).length;
console.log(`✅ 快照已写入 frontend/fallback.json`);
console.log(`   区块 #${blockNumber} · ${count} 张卡 · 累计 ${totalVotes} 票 · ${inPool} 张已入池 · ${Object.keys(profiles).length} 份简历`);
console.log(`   写快照的时刻: ${out.savedAt}`);
console.log(`\n👉 前端在 RPC 读不到链时会自动降级使用它，并在顶部标注"离线快照"。`);
console.log(`   演示前建议重跑一次，让快照尽量新：npm run snapshot`);