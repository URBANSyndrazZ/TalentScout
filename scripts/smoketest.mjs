// 冒烟测试：小号投票/打赏/留言/标记意向 + 主办方阈值调整
// 注意：Monad 新充值账户需 ~1.2s 资金可见；低余额账户(<10 MON)每 ~1.2s 只能发 1 笔交易
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JsonRpcProvider, Wallet, Contract, parseEther, formatEther } from "ethers";

dotenv.config({ quiet: true });
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const RPC_URL = process.env.RPC_URL ?? "https://testnet-rpc.monad.xyz";
const dep = JSON.parse(fs.readFileSync(path.join(root, "deployments.json"), "utf8"));
const artifact = JSON.parse(fs.readFileSync(path.join(root, "artifacts", "TalentScout.json"), "utf8"));
const provider = new JsonRpcProvider(RPC_URL);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const deployer = new Wallet(process.env.PRIVATE_KEY.trim(), provider);
const organizerContract = new Contract(dep.contractAddress, artifact.abi, deployer);

const [curThreshold] = await organizerContract.getStats().then((r) => [r[1]]);
if (Number(curThreshold) !== 5) {
  const t = await organizerContract.setVoteThreshold(5, { gasLimit: 100_000n });
  await t.wait();
  console.log("🔧 阈值已设为 5 ·", dep.explorer + "/tx/" + t.hash);
  await sleep(1500);
} else {
  console.log("🔧 阈值已是 5，跳过");
}

const burnerFile = path.join(root, ".burner.json");
let burner;
if (fs.existsSync(burnerFile)) {
  burner = new Wallet(JSON.parse(fs.readFileSync(burnerFile, "utf8")).privateKey, provider);
} else {
  burner = Wallet.createRandom().connect(provider);
  fs.writeFileSync(burnerFile, JSON.stringify({ privateKey: burner.privateKey, note: "演示用小号钱包（测试网）" }, null, 2));
}
let bBal = await provider.getBalance(burner.address);
if (bBal < parseEther("0.1")) {
  const fund = await deployer.sendTransaction({ to: burner.address, value: parseEther("0.5"), gasLimit: 100_000n });
  await fund.wait();
  console.log("💸 已给小号充值 0.5 MON，等待 ~2.5s 使其在共识层可见…");
  await sleep(2500);
  bBal = await provider.getBalance(burner.address);
}
console.log("👤 演示小号:", burner.address, "· 余额", formatEther(bBal), "MON（私钥已存 .burner.json，可导入手机演示）");

const bc = new Contract(dep.contractAddress, artifact.abi, burner);

async function sendSpaced(label, fn) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const tx = await fn();
      await tx.wait();
      console.log("✅", label, "·", dep.explorer + "/tx/" + tx.hash);
      await sleep(1600); // 低余额账户节流：每 ~1.2s 一笔
      return;
    } catch (e) {
      const msg = e.shortMessage ?? e.message ?? String(e);
      if (attempt < 4 && /insufficient balance|could not coalesce|nonce/i.test(msg)) {
        console.log("⏳", label, "遇到瞬时问题，2s 后重试（第", attempt, "次）：", msg.slice(0, 80));
        await sleep(2000);
        continue;
      }
      throw e;
    }
  }
}

await sendSpaced("投票 #1", () => bc.vote(1, { gasLimit: 200_000n }));
await sendSpaced("投票 #2", () => bc.vote(2, { gasLimit: 200_000n }));
await sendSpaced("投票 #3", () => bc.vote(3, { gasLimit: 200_000n }));
await sendSpaced("打赏 #1 0.05 MON", () => bc.tip(1, { value: parseEther("0.05"), gasLimit: 120_000n }));
await sendSpaced("留言 #1", () => bc.postMessage(1, "偷偷告诉面试官：这张卡我先投了 🚀", { value: parseEther("0.01"), gasLimit: 250_000n }));
await sendSpaced("标记意向 #2", () => bc.markInterest(2, { gasLimit: 150_000n }));

const c1 = await bc.getCandidate(1);
const msgs = await bc.getMessages(1);
const voted = await bc.hasVoted(1, burner.address);
console.log("\n📊 验证：卡#1 票数 =", c1.votes.toString(), "· 支持金 =", formatEther(c1.tips), "MON · 留言数 =", c1.msgCount.toString());
console.log("   留言内容:", msgs.join(" | "));
console.log("   小号已投票:", voted);
const [ids, votes] = await bc.getTop(3);
console.log("🏆 Top3:", ids.map((v, i) => "#" + v + "(" + votes[i] + "票)").join(" "));