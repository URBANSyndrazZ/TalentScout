// 部署 ProfileRegistry（链上简历登记处）到 Monad 测试网，并绑定已部署的 TalentScout
// 运行: npm run deploy-profile   （需要 .env 的 PRIVATE_KEY 有测试币）
// 说明：不重新部署 TalentScout —— 已上链的自荐卡、票数、打赏、留言全部保留
import dotenv from "dotenv";
import { JsonRpcProvider, Wallet, Contract, ContractFactory, formatEther } from "ethers";
import { ROOT, DEPLOYMENTS, readJson, readArtifact, writeContractConfig, patchDeployments } from "./write-config.mjs";

dotenv.config({ quiet: true });

const RPC_URL = process.env.RPC_URL ?? "https://testnet-rpc.monad.xyz";
const EXPLORER = process.env.EXPLORER ?? "https://testnet.monadscan.com";
const FAUCET = "https://faucet.monad.xyz";

const dep = readJson(DEPLOYMENTS);
if (!dep.contractAddress) {
  console.error("❌ deployments.json 里没有 TalentScout 地址。先运行：npm run deploy");
  process.exit(1);
}
const artifact = readArtifact("ProfileRegistry");

const privateKey = process.env.PRIVATE_KEY?.trim();
if (!privateKey || !/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
  console.error("❌ .env 里的 PRIVATE_KEY 无效或为空。");
  process.exit(1);
}

const provider = new JsonRpcProvider(RPC_URL);
const network = await provider.getNetwork();
const wallet = new Wallet(privateKey, provider);
const balance = await provider.getBalance(wallet.address);

console.log(`🔗 chainId = ${network.chainId}`);
console.log(`👛 部署账户: ${wallet.address} · 余额 ${formatEther(balance)} MON`);
console.log(`🔗 绑定 TalentScout: ${dep.contractAddress}`);
if (balance === 0n) {
  console.error(`\n❌ 余额为 0。去 ${FAUCET} 给 ${wallet.address} 领测试币后再试。`);
  process.exit(1);
}

// Monad 按 gasLimit 计费（不是 gasUsed）：部署开销 ≈ bytecode 字节数 × 200 + 构造函数，留 40% 余量
const deployGas = BigInt(Math.ceil((artifact.bytecode.length / 2) * 200 * 1.4)) + 300_000n;
console.log(`\n🚀 部署 ProfileRegistry（gasLimit ${deployGas}，按字节数算出来，不是拍脑袋的 200 万）...`);
const factory = new ContractFactory(artifact.abi, artifact.bytecode, wallet);
const contract = await factory.deploy(dep.contractAddress, { gasLimit: deployGas });
const tx = contract.deploymentTransaction();
console.log(`   交易哈希: ${tx.hash}`);
console.log(`   浏览器查看: ${EXPLORER}/tx/${tx.hash}`);

await contract.waitForDeployment();
const address = await contract.getAddress();
const receipt = await tx.wait();
const scout = new Contract(dep.contractAddress, readArtifact("TalentScout").abi, provider);

console.log("\n✅ 部署成功！");
console.log(`   ProfileRegistry: ${address}`);
console.log(`   浏览器查看: ${EXPLORER}/address/${address}`);
console.log(`   区块高度: ${receipt.blockNumber} · gasUsed: ${receipt.gasUsed.toString()}`);

// 自检：跨合约读取能否拿到卡片 owner（证明绑定正确）
try {
  const c = await scout.getCandidate(1);
  const onchain = await contract.scout();
  console.log(`   ✅ 绑定自检：card#1 owner=${c.owner} · 合约记录的 scout=${onchain}`);
} catch (e) {
  console.log("   ⚠️ 绑定自检失败:", e.shortMessage ?? e.message);
}

writeContractConfig({
  chainId: Number(network.chainId),
  rpcUrl: RPC_URL,
  explorer: EXPLORER,
  scout: dep.contractAddress,
  profile: address,
});

patchDeployments({
  network: dep.network ?? "Monad Testnet",
  chainId: Number(network.chainId),
  rpcUrl: RPC_URL,
  explorer: EXPLORER,
  contractAddress: dep.contractAddress,
  deployer: dep.deployer ?? wallet.address,
  profileRegistry: {
    address,
    txHash: tx.hash,
    blockNumber: receipt.blockNumber,
    deployedAt: new Date().toISOString(),
  },
});

console.log("\n📄 已更新 frontend/contract.config.js 和 deployments.json");
console.log("👉 下一步: npm run seed-profiles（给已有自荐卡补简历资料）");
console.log(`   项目根目录: ${ROOT}`);