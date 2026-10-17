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
const bc = new Contract(dep.contractAddress, artifact.abi, burner);
console.log("burner:", burner.address, "· 余额", formatEther(await provider.getBalance(burner.address)), "MON");

async function paced(label, fn) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const tx = await fn();
      await tx.wait();
      console.log("✅", label, "·", dep.explorer + "/tx/" + tx.hash);
      await sleep(4500); // 低余额账户节流：留足间隔
      return true;
    } catch (e) {
      console.log("⚠️", label, "第" + attempt + "次失败：", (e.error?.message ?? e.shortMessage ?? e.message).slice(0, 80));
      await sleep(5000);
    }
  }
  return false;
}

await paced("打赏 #1 0.05 MON", () => bc.tip(1, { value: parseEther("0.05"), gasLimit: 120_000n }));
await paced("留言 #1", () => bc.postMessage(1, "偷偷告诉面试官：这张卡我先投了 🚀", { value: parseEther("0.01"), gasLimit: 250_000n }));
await paced("标记意向 #2", () => bc.markInterest(2, { gasLimit: 150_000n }));

const c1 = await bc.getCandidate(1);
const msgs = await bc.getMessages(1);
console.log("\n📊 卡#1 票数 =", c1.votes.toString(), "· 支持金 =", formatEther(c1.tips), "MON · 留言 =", c1.msgCount.toString());
console.log("   留言内容:", msgs.join(" | "));
const [ids, votes] = await bc.getTop(5);
console.log("🏆 Top5:", ids.map((v, i) => "#" + v + "(" + votes[i] + "票)").join(" "));