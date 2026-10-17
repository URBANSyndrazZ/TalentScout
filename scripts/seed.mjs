// 给 TalentScout 播种 8 张样例自荐卡（方便演示前有初始数据）
// 运行: npm run seed
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JsonRpcProvider, Wallet, Contract } from "ethers";

dotenv.config({ quiet: true });

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const RPC_URL = process.env.RPC_URL ?? "https://testnet-rpc.monad.xyz";
const EXPLORER = process.env.EXPLORER ?? "https://testnet.monadscan.com";

const dep = JSON.parse(fs.readFileSync(path.join(root, "deployments.json"), "utf8"));
const artifact = JSON.parse(fs.readFileSync(path.join(root, "artifacts", "TalentScout.json"), "utf8"));

const privateKey = process.env.PRIVATE_KEY?.trim();
if (!privateKey) { console.error("❌ .env 里缺 PRIVATE_KEY"); process.exit(1); }

const provider = new JsonRpcProvider(RPC_URL);
const wallet = new Wallet(privateKey, provider);
const contract = new Contract(dep.contractAddress, artifact.abi, wallet);

const samples = [
  { name: "阿茶", tagline: "合约写得比文案快，Demo 讲得比代码好", skills: "Solidity,前端,演示", links: "", theme: 0 },
  { name: "Luna", tagline: "把复杂协议讲成人话的产品经理", skills: "产品,叙事,交互", links: "", theme: 1 },
  { name: "老周", tagline: "十年后端，一夜上链，不慌", skills: "Go,Solidity,架构", links: "", theme: 2 },
  { name: "小鹿", tagline: "设计稿落地率 200%（含老板的份）", skills: "UI/UX,品牌,插画", links: "", theme: 3 },
  { name: "Ken", tagline: "AI Agent 驯兽师，Prompt 即武器", skills: "AI,Agent,自动化", links: "", theme: 4 },
  { name: "泡泡", tagline: "链上活动气氛组组长，专治冷场", skills: "社区,运营,内容", links: "", theme: 5 },
  { name: "阿杰", tagline: "全栈莽夫，两周学完就敢上线", skills: "全栈,快速原型", links: "", theme: 6 },
  { name: "Mia", tagline: "能把数据讲成故事的工程师", skills: "数据,可视化,增长", links: "", theme: 7 },
];

console.log(`📇 目标合约: ${dep.contractAddress}`);
console.log(`👛 播种账户: ${wallet.address}\n`);

for (const s of samples) {
  const tx = await contract.publish(s.name, s.tagline, s.skills, s.links, s.theme, { gasLimit: 900_000n });
  const receipt = await tx.wait();
  console.log(`✅ #发布 ${s.name} · gasUsed ${receipt.gasUsed} · ${EXPLORER}/tx/${tx.hash}`);
}

const [count, threshold] = await contract.getStats();
console.log(`\n📊 当前候选人数: ${count} · 入池阈值: ${threshold}`);
const [ids, votes] = await contract.getTop(3);
console.log("🏆 Top3 快照:", ids.map((id, i) => `#${id}(${votes[i]}票)`).join(" "));
console.log("\n👉 下一步: npm run serve 打开前端");