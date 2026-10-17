// 主办方发 gas 补贴：给现场观众的钱包转一点 MON，让他们能零成本投票
//
// 用法：
//   node scripts/sponsor.mjs 0xabc... 0xdef...        # 每人 0.05 MON（默认）
//   node scripts/sponsor.mjs --amount 0.03 0xabc...
//   node scripts/sponsor.mjs --file addrs.txt         # 每行一个地址（# 开头是注释）
//   node scripts/sponsor.mjs --dry 0xabc...           # 只算钱，不发交易
//   node scripts/sponsor.mjs --keep 0.2 0xabc...      # 保留余额下限（默认 0.1 MON）
//
// 为什么需要它：观众投票要付 gas，而"先装钱包、再领水、再切网络"是三步摩擦。
// 主办方补贴 gas 是最快的解法（也是"谁付 gas 就是谁买单"这条商业模式的雏形）——
// 真正的长期解法是内嵌钱包 + 元交易代付，见 docs/答辩Q&A.md。
import dotenv from "dotenv";
import fs from "node:fs";
import { JsonRpcProvider, Wallet, formatEther, parseEther, isAddress } from "ethers";

dotenv.config({ quiet: true });

const RPC_URL = process.env.RPC_URL ?? "https://testnet-rpc.monad.xyz";
const EXPLORER = process.env.EXPLORER ?? "https://testnet.monadscan.com";
const GAS_LIMIT = 25_000n; // 普通转账 21,000 gas，留点余量（Monad 按 gasLimit 计费）

/* ───────── 解析参数 ───────── */
const argv = process.argv.slice(2);
const flags = { amount: "0.05", keep: "0.1", dry: false, file: null };
const targets = [];

for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--dry") flags.dry = true;
  else if (a === "--amount") flags.amount = argv[++i];
  else if (a === "--keep") flags.keep = argv[++i];
  else if (a === "--file") flags.file = argv[++i];
  else if (a.startsWith("--")) { console.error(`❌ 不认识的参数：${a}`); process.exit(1); }
  else targets.push(a);
}

if (flags.file) {
  if (!fs.existsSync(flags.file)) { console.error(`❌ 找不到文件：${flags.file}`); process.exit(1); }
  const lines = fs.readFileSync(flags.file, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const t = line.split("#")[0].trim();
    if (t) targets.push(t);
  }
}

if (!targets.length) {
  console.log(`用法：
  node scripts/sponsor.mjs 0xabc... 0xdef...      # 给这些地址补贴 gas
  node scripts/sponsor.mjs --file addrs.txt       # 从文件读（每行一个地址）
  node scripts/sponsor.mjs --dry 0xabc...         # 只算钱不发
  node scripts/sponsor.mjs --amount 0.03 --keep 0.2 0xabc...
`);
  process.exit(0);
}

const amount = parseEther(String(flags.amount));
const keep = parseEther(String(flags.keep));

// 去重 + 校验（顺手把手写的地址统一成 checksum 格式）
const seen = new Set();
const list = [];
let bad = 0;
for (const raw of targets) {
  const addr = raw.trim();
  if (!isAddress(addr)) { console.log(`⏭️  跳过非法地址：${addr}`); bad++; continue; }
  const key = addr.toLowerCase();
  if (seen.has(key)) { console.log(`⏭️  跳过重复地址：${addr}`); continue; }
  seen.add(key);
  list.push(addr);
}

if (!list.length) { console.error("❌ 没有可用的目标地址"); process.exit(1); }

/* ───────── 连接与预算 ───────── */
const privateKey = process.env.PRIVATE_KEY?.trim();
if (!privateKey) { console.error("❌ .env 里缺 PRIVATE_KEY（补贴发款账户）"); process.exit(1); }

const provider = new JsonRpcProvider(RPC_URL);
const wallet = new Wallet(privateKey, provider);
const balance = await provider.getBalance(wallet.address);
const feeData = await provider.getFeeData();
const gasPrice = feeData.gasPrice ?? 0n;

const gasCostEach = GAS_LIMIT * gasPrice;
const totalOut = amount * BigInt(list.length);
const totalFee = gasCostEach * BigInt(list.length);
const total = totalOut + totalFee;
const left = balance - total;

console.log(`👛 补贴发款账户: ${wallet.address}`);
console.log(`💰 当前余额: ${formatEther(balance)} MON · 当前 gasPrice ${(Number(gasPrice) / 1e9).toFixed(2)} gwei`);
console.log(`🎯 目标: ${list.length} 个地址 · 每人 ${formatEther(amount)} MON`);
console.log(`🧾 预计支出: 补贴 ${formatEther(totalOut)} + gas 约 ${formatEther(totalFee)} = ${formatEther(total)} MON`);
console.log(`   发完后余额: ${formatEther(left)} MON（保留下限 ${formatEther(keep)}）\n`);

if (left < keep) {
  console.error(`❌ 余额不够：发完只剩 ${formatEther(left)} MON，低于保留下限 ${formatEther(keep)}。`);
  console.error(`   要么调小 --amount，要么先给 ${wallet.address} 补水（测试网水龙头 https://faucet.monad.xyz）。`);
  process.exit(1);
}

if (flags.dry) {
  console.log("🔍 --dry 模式：只算账，不发交易。地址清单：");
  list.forEach((a, i) => console.log(`   ${i + 1}. ${a}`));
  process.exit(0);
}

/* ───────── 逐个发款 ───────── */
// 低余额账户（<10 MON）每 ~1.2 秒只能发 1 笔交易，故意留间隔
const GAP = 1500;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

console.log("🚀 开始发放 gas 补贴（每笔间隔 1.5 秒，避开低余额节流）...\n");
let ok = 0, fail = 0;
const sent = [];

for (const addr of list) {
  try {
    const tx = await wallet.sendTransaction({ to: addr, value: amount, gasLimit: GAS_LIMIT });
    await tx.wait();
    ok++;
    sent.push({ addr, hash: tx.hash });
    console.log(`✅ ${addr}  +${formatEther(amount)} MON`);
    console.log(`   ${EXPLORER}/tx/${tx.hash}`);
  } catch (e) {
    fail++;
    console.log(`❌ ${addr}  失败：${e.shortMessage ?? e.message}`);
  }
  await sleep(GAP);
}

const after = await provider.getBalance(wallet.address);
console.log(`\n📊 完成：成功 ${ok} 笔 · 失败 ${fail} 笔${bad ? ` · 跳过非法地址 ${bad} 个` : ""}`);
console.log(`   实际支出 ${formatEther(balance - after)} MON · 剩余 ${formatEther(after)} MON`);
if (sent.length) {
  console.log(`\n🔗 全部交易（可按顺序贴进答辩材料）：`);
  sent.forEach((s) => console.log(`   ${s.addr}  ${EXPLORER}/tx/${s.hash}`));
}
console.log(`\n👉 观众拿到 gas 后即可打开前端投票：npm run serve → http://localhost:8080/frontend/`);