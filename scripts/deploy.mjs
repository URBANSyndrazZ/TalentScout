// 部署 TalentScout 到 Monad 测试网
// 运行: npm run deploy （需要 .env 里有 PRIVATE_KEY 且账户有测试币）
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JsonRpcProvider, Wallet, ContractFactory, formatEther } from "ethers";
import { writeContractConfig, patchDeployments } from "./write-config.mjs";

dotenv.config({ quiet: true });

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const RPC_URL = process.env.RPC_URL ?? "https://testnet-rpc.monad.xyz";
const EXPLORER = process.env.EXPLORER ?? "https://testnet.monadscan.com";
const FAUCET = "https://faucet.monad.xyz";

const artifactPath = path.join(root, "artifacts", "TalentScout.json");
if (!fs.existsSync(artifactPath)) {
  console.error("❌ 还没编译过合约。先运行：npm run compile");
  process.exit(1);
}
const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

const privateKey = process.env.PRIVATE_KEY?.trim();
if (!privateKey || !/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
  console.error("❌ .env 里的 PRIVATE_KEY 无效或为空。可从 monad-demo 复制一份 .env。");
  process.exit(1);
}

const provider = new JsonRpcProvider(RPC_URL);
const network = await provider.getNetwork();
console.log(`🔗 已连接 chainId = ${network.chainId}`);
const wallet = new Wallet(privateKey, provider);
const balance = await provider.getBalance(wallet.address);
console.log(`👛 部署账户: ${wallet.address}`);
console.log(`💰 账户余额: ${formatEther(balance)} MON`);

if (balance === 0n) {
  console.error(`\n❌ 余额为 0。去 ${FAUCET} 给 ${wallet.address} 领测试币后再试。`);
  process.exit(1);
}

console.log("\n🚀 正在部署 TalentScout（gasLimit 固定 6,000,000，Monad 按 gas limit 计费）...");
const factory = new ContractFactory(artifact.abi, artifact.bytecode, wallet);
const contract = await factory.deploy({ gasLimit: 6_000_000n });
const tx = contract.deploymentTransaction();
console.log(`   交易哈希: ${tx.hash}`);
console.log(`   浏览器查看: ${EXPLORER}/tx/${tx.hash}`);

await contract.waitForDeployment();
const address = await contract.getAddress();
const receipt = await tx.wait();

console.log("\n✅ 部署成功！");
console.log(`   合约地址: ${address}`);
console.log(`   区块高度: ${receipt.blockNumber} · gasUsed: ${receipt.gasUsed.toString()}`);
console.log(`   浏览器查看: ${EXPLORER}/address/${address}`);

// 重新部署 TalentScout 后，旧的 ProfileRegistry 绑的是旧合约地址，必须一起作废（跑 npm run deploy-profile 重绑）
writeContractConfig({
  chainId: Number(network.chainId), rpcUrl: RPC_URL, explorer: EXPLORER, scout: address,
});

patchDeployments({
  network: "Monad Testnet", chainId: Number(network.chainId), rpcUrl: RPC_URL, explorer: EXPLORER,
  contractAddress: address, deployer: wallet.address, txHash: tx.hash, blockNumber: receipt.blockNumber,
  deployedAt: new Date().toISOString(),
}, ["profileRegistry"]);

console.log("\n📄 已更新 frontend/contract.config.js 和 deployments.json");
console.log("👉 下一步: npm run deploy-profile（部署简历登记处）→ npm run seed（发样例卡）→ npm run serve");