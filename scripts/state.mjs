import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JsonRpcProvider, Wallet, Contract, formatEther } from "ethers";
dotenv.config({ quiet: true });
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dep = JSON.parse(fs.readFileSync(path.join(root, "deployments.json"), "utf8"));
const artifact = JSON.parse(fs.readFileSync(path.join(root, "artifacts", "TalentScout.json"), "utf8"));
const provider = new JsonRpcProvider(process.env.RPC_URL ?? "https://testnet-rpc.monad.xyz");
const c = new Contract(dep.contractAddress, artifact.abi, provider);
const deployer = new Wallet(process.env.PRIVATE_KEY.trim(), provider);
const burner = new Wallet(JSON.parse(fs.readFileSync(path.join(root, ".burner.json"), "utf8")).privateKey, provider);
console.log("deployer:", deployer.address, "·", formatEther(await provider.getBalance(deployer.address)), "MON");
console.log("burner  :", burner.address, "·", formatEther(await provider.getBalance(burner.address)), "MON");
const [count, threshold] = await c.getStats();
console.log("candidates:", count.toString(), "· threshold:", threshold.toString());
for (let i = 1; i <= Number(count); i++) {
  const x = await c.getCandidate(i);
  console.log(`#${i} ${x.name} 票=${x.votes} 金=${formatEther(x.tips)} 留言=${x.msgCount} 意向=${x.interestCount} 入池=${x.recommended} owner=${x.owner.slice(0,8)}`);
}
console.log("--- my votes (burner) ---");
for (let i = 1; i <= Number(count); i++) {
  const v = await c.hasVoted(i, burner.address);
  if (v) console.log("burner voted #" + i);
}
