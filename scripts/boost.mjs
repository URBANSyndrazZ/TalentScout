// boost.mjs —— 补票脚本：
//   1) 给 deployer 回充 1 MON（保障主办方终场操作）
//   2) 创建 4 个"社区演示钱包" W1-W4 并各充值 0.3 MON
//   3) W1-W4 各给 #1 投一票 → #1 = 5 票，触发"已入池"（预置状态）
//   4) W1-W4 各给 #4 投一票 → #4 = 4 票（现场演示时用手机小号投出第 5 票）
// 特性：幂等（已投过的跳过）、失败重试、低余额节流自动间隔
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JsonRpcProvider, Wallet, Contract, parseEther, formatEther } from "ethers";

dotenv.config({ quiet: true });
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dep = JSON.parse(fs.readFileSync(path.join(root, "deployments.json"), "utf8"));
const artifact = JSON.parse(fs.readFileSync(path.join(root, "artifacts", "TalentScout.json"), "utf8"));
const provider = new JsonRpcProvider(process.env.RPC_URL ?? "https://testnet-rpc.monad.xyz");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const burner = new Wallet(JSON.parse(fs.readFileSync(path.join(root, ".burner.json"), "utf8")).privateKey, provider);
const deployer = new Wallet(process.env.PRIVATE_KEY.trim(), provider);
console.log("burner  :", burner.address, "·", formatEther(await provider.getBalance(burner.address)), "MON");
console.log("deployer:", deployer.address, "·", formatEther(await provider.getBalance(deployer.address)), "MON");

// ── 1) 演示钱包 W1-W4 ──
const walletsFile = path.join(root, ".demo-wallets.json");
let keys = [];
if (fs.existsSync(walletsFile)) {
  keys = JSON.parse(fs.readFileSync(walletsFile, "utf8")).wallets;
} else {
  keys = Array.from({ length: 4 }, () => Wallet.createRandom().privateKey);
  fs.writeFileSync(walletsFile, JSON.stringify({ note: "社区演示投票钱包（测试网）", wallets: keys }, null, 2));
  console.log("🆕 已生成 4 个演示钱包 → .demo-wallets.json");
}
const ws = keys.map((k) => new Wallet(k, provider));
console.log("演示钱包:", ws.map((w) => w.address.slice(0, 8)).join(", "));

const burnerContract = new Contract(dep.contractAddress, artifact.abi, burner);

async function sendSpaced(label, fn, txWallet) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const tx = await fn();
      await tx.wait();
      console.log("✅", label, "·", dep.explorer + "/tx/" + tx.hash);
      await sleep(5500); // 低余额账户节流：保守间隔
      return tx;
    } catch (e) {
      const msg = (e.shortMessage ?? e.message ?? String(e)).slice(0, 90);
      console.log("⚠️", label, "第" + attempt + "次失败:", msg);
      await sleep(6000);
    }
  }
  console.log("❌", label, "最终失败（跳过）");
  return null;
}

// ── 2) 回充 deployer + 给 W1-W4 充值 ──
const depBal = await provider.getBalance(deployer.address);
if (depBal < parseEther("0.5")) {
  await sendSpaced("回充 deployer 1 MON", () => burner.sendTransaction({ to: deployer.address, value: parseEther("1.0"), gasLimit: 100_000n }));
} else {
  console.log("💰 deployer 余额充足，跳过回充");
}
for (const w of ws) {
  const bal = await provider.getBalance(w.address);
  if (bal < parseEther("0.1")) {
    await sendSpaced("充值 " + w.address.slice(0, 8), () => burner.sendTransaction({ to: w.address, value: parseEther("0.3"), gasLimit: 100_000n }));
  } else {
    console.log("💰", w.address.slice(0, 8), "余额充足，跳过充值");
  }
}
console.log("⏳ 等待 4s 让资金在共识层可见…");
await sleep(4000);

// ── 3) 投票 ──
const contractOf = (w) => new Contract(dep.contractAddress, artifact.abi, w);
async function voteIfNeeded(label, w, id) {
  const c = contractOf(w);
  const voted = await c.hasVoted(id, w.address);
  if (voted) { console.log("↩️", label, "已投过，跳过"); return; }
  await sendSpaced(label, () => c.vote(id, { gasLimit: 200_000n }));
}

console.log("\n── #1 补票（目标 5 票 → 入池）──");
for (let i = 0; i < ws.length; i++) await voteIfNeeded(`W${i + 1} 投 #1`, ws[i], 1);

console.log("\n── #4 补票（目标 4 票，留 1 票给现场手机演示）──");
for (let i = 0; i < ws.length; i++) await voteIfNeeded(`W${i + 1} 投 #4`, ws[i], 4);

// ── 4) 终态验证 ──
console.log("\n📊 终态验证：");
for (const id of [1, 2, 3, 4]) {
  const x = await burnerContract.getCandidate(id);
  console.log(`#${id} ${x.name} 票=${x.votes} 入池=${x.recommended} 金=${formatEther(x.tips)} 留言=${x.msgCount} 意向=${x.interestCount}`);
}
console.log("\nburner 余额:", formatEther(await provider.getBalance(burner.address)), "MON");
console.log("deployer 余额:", formatEther(await provider.getBalance(deployer.address)), "MON");