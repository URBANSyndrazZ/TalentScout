// 给已有自荐卡补"基本信息 + 简历"（写入 ProfileRegistry，链上存证）
// 运行: npm run seed-profiles
// 说明：简历 JSON 里用英文 key，前端渲染时映射成中文标签；单卡 ≤ 2000 字节（合约限制）
import dotenv from "dotenv";
import path from "node:path";
import { JsonRpcProvider, Wallet, Contract, keccak256, toUtf8Bytes } from "ethers";
import { ROOT, DEPLOYMENTS, readJson, readArtifact } from "./write-config.mjs";

dotenv.config({ quiet: true });

const RPC_URL = process.env.RPC_URL ?? "https://testnet-rpc.monad.xyz";
const EXPLORER = process.env.EXPLORER ?? "https://testnet.monadscan.com";

const dep = readJson(DEPLOYMENTS);
if (!dep.profileRegistry?.address) {
  console.error("❌ deployments.json 里没有 profileRegistry。先运行：npm run deploy-profile");
  process.exit(1);
}
const artifact = readArtifact("ProfileRegistry");
const scoutAbi = readArtifact("TalentScout").abi;

const privateKey = process.env.PRIVATE_KEY?.trim();
if (!privateKey) { console.error("❌ .env 里缺 PRIVATE_KEY"); process.exit(1); }

const provider = new JsonRpcProvider(RPC_URL);
const wallet = new Wallet(privateKey, provider);
const registry = new Contract(dep.profileRegistry.address, artifact.abi, wallet);
const scout = new Contract(dep.contractAddress, scoutAbi, provider);

// 低余额账户（<10 MON）每 ~1.2 秒只能发 1 笔，脚本自动间隔
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const GAP = 1500;

// Monad 按 gasLimit 计费（不是 gasUsed），给宽了就是直接烧钱：
// 留 25% 余量，按 JSON 字节数动态算 —— 32 字节一个存储槽 × 20,000 gas
const gasForResume = (bytes) => 400_000n + BigInt(Math.ceil(bytes / 32) + 4) * 20_000n;
// 更新（非零 → 非零）每个存储槽只要 5,000 gas，比首次写入便宜约 4 倍 —— 别拿首写公式去更新
const gasForResumeUpdate = (bytes) => 250_000n + BigInt(Math.ceil(bytes / 32) + 6) * 10_000n;

// 联系方式：候选人主动公开的接触入口。企业标记意向后，这里是唯一"能往下走一步"的地方。
// ⚠️ 链上写什么都是永久的、可被爬的 —— 所以只放能屏蔽的渠道（Telegram / X），不放手机号。
const CONTACTS = {
  1: "Telegram @achaa_dev（优先）· acha@hey.com",
  2: "X @luna_pm · luna.pm@hey.com",
  3: "Telegram @zhou_arch · zhou@hey.com",
  4: "Telegram @xiaolu_design · X @xiaolu_ux",
  5: "Telegram @ken_agent · ken@hey.com",
  6: "X @paopao_community（优先）",
  7: "Telegram @ajie_dev · ajie@hey.com",
  8: "X @mia_data · mia@hey.com",
};

const PROFILES = {
  1: {
    role: "智能合约工程师", city: "上海", exp: "3 年", edu: "本科 · 计算机科学",
    skills: ["Solidity", "TypeScript", "DeFi"],
    availability: "随时到岗 · 可远程",
    summary: "写过 6 个上主网的合约，最擅长把一个模糊的想法在两周内变成能演示、能上链的东西。喜欢在黑客松现场讲 Demo，能把技术细节讲给非技术的人听。",
    experience: [
      { co: "某 DeFi 协议", title: "合约工程师", time: "2024-2026", desc: "负责借贷模块与清算逻辑，审计零高危；链上 TVL 峰值 800 万美元" },
      { co: "独立开发者", title: "自由职业", time: "2023-2024", desc: "为 3 个团队做过 NFT / 积分系统的合约开发与部署" },
    ],
  },
  2: {
    role: "产品经理（Web3 方向）", city: "杭州", exp: "4 年", edu: "硕士 · 人机交互",
    skills: ["产品设计", "叙事", "交互"],
    availability: "两周内到岗 · 可远程",
    summary: "把复杂协议讲成人话是我的核心能力。做过 2 个从 0 到 1 的 Web3 产品，擅长用户访谈、写清楚的需求文档，以及在评审会上替用户说话。",
    experience: [
      { co: "某钱包团队", title: "高级产品经理", time: "2023-2026", desc: "主导跨链 Swap 体验改版，7 日留存提升 34%" },
      { co: "某交易所", title: "产品经理", time: "2021-2023", desc: "负责理财板块，累计管理规模 3 亿美元" },
    ],
  },
  3: {
    role: "后端 / 架构工程师", city: "北京", exp: "10 年", edu: "本科 · 软件工程",
    skills: ["Go", "Solidity", "分布式架构"],
    availability: "一个月内到岗 · 可远程",
    summary: "十年后端，从单体做到微服务再做到链上。不追新词，只问一句：这东西上线后半夜会不会把我叫醒。近一年把 Go 服务与链上合约打通，做过多链索引器。",
    experience: [
      { co: "某云服务商", title: "后端架构师", time: "2019-2025", desc: "日均 20 亿请求的网关重构，P99 延迟下降 60%" },
      { co: "独立项目", title: "链上索引器", time: "2025-2026", desc: "自建多链事件索引服务，支撑 3 个 DApp 的活动流" },
    ],
  },
  4: {
    role: "UI/UX 设计师", city: "深圳", exp: "5 年", edu: "本科 · 视觉传达",
    skills: ["UI/UX", "品牌", "插画"],
    availability: "随时到岗 · 仅远程",
    summary: "设计稿落地率 200%（含老板的那份需求）。做过交易所、钱包、NFT 市场的界面，也画过整套品牌插画。坚持一件事：任何一个界面，第一屏就要让人知道该点哪里。",
    experience: [
      { co: "某 NFT 市场", title: "设计负责人", time: "2023-2026", desc: "重建设计系统，落地效率提升一倍；主站改版后转化率 +22%" },
      { co: "设计工作室", title: "UI 设计师", time: "2021-2023", desc: "为 20+ 客户做过品牌与产品界面" },
    ],
  },
  5: {
    role: "AI 工程师（Agent 方向）", city: "上海", exp: "2 年", edu: "硕士 · 人工智能",
    skills: ["Python", "Agent", "LLM 应用"],
    availability: "随时到岗 · 可远程",
    summary: "驯养过 30 多个 Agent，处理过它们半夜乱调 API 的现场。熟悉工具调用、多轮规划、评估集搭建；把 Prompt 当工程问题而不是玄学来对待。",
    experience: [
      { co: "某 AI 创业公司", title: "算法工程师", time: "2024-2026", desc: "搭建客服 Agent，人工转接率下降 45%" },
      { co: "高校实验室", title: "研究助理", time: "2023-2024", desc: "参与对话系统评测集构建，发表 1 篇会议论文" },
    ],
  },
  6: {
    role: "社区运营 / 内容", city: "成都", exp: "3 年", edu: "本科 · 新闻传播",
    skills: ["社区运营", "内容", "活动策划"],
    availability: "随时到岗 · 可远程",
    summary: "链上活动气氛组组长，专治冷场。运营过 5 万人规模的社区，办过 40+ 场线上活动；擅长把一条工程进展写成大家愿意转发的故事。",
    experience: [
      { co: "某公链社区", title: "社区负责人", time: "2023-2026", desc: "社群从 8 千做到 5 万；策划的活动单场最高 1.2 万人参与" },
      { co: "MCN 机构", title: "内容运营", time: "2022-2023", desc: "负责科技类账号，单条最高播放 320 万" },
    ],
  },
  7: {
    role: "全栈工程师", city: "广州", exp: "3 年", edu: "本科 · 信息工程",
    skills: ["全栈", "React", "Node.js"],
    availability: "随时到岗 · 可远程",
    summary: "全栈莽夫，两周学完就敢上线。做过 10 多个从想法到可用产品的项目，前端后端部署都能自己扛；信奉先跑起来，再跑得更好。",
    experience: [
      { co: "某 SaaS 公司", title: "全栈工程师", time: "2023-2026", desc: "从 0 搭建管理后台与 API，服务 200 家企业客户" },
      { co: "外包团队", title: "前端开发", time: "2022-2023", desc: "交付 15+ 个中小型项目" },
    ],
  },
  8: {
    role: "数据工程师 / 增长分析", city: "上海", exp: "4 年", edu: "硕士 · 统计学",
    skills: ["SQL", "数据可视化", "增长分析"],
    availability: "两周内到岗 · 可远程",
    summary: "能把数据讲成故事的工程师。搭过从采集到看板的整套链路，也做过增长实验的设计与复盘；坚持结论要能被业务直接拿去用。",
    experience: [
      { co: "某电商平台", title: "数据工程师", time: "2022-2026", desc: "搭建用户行为数仓，支撑 30+ 看板与 A/B 实验平台" },
      { co: "咨询公司", title: "数据分析师", time: "2021-2022", desc: "为消费品牌做增长诊断与指标体系" },
    ],
  },
};

const [countRaw] = await scout.getStats();
const count = Number(countRaw);
console.log(`📇 TalentScout: ${dep.contractAddress}`);
console.log(`📄 ProfileRegistry: ${dep.profileRegistry.address}`);
console.log(`👛 写入账户: ${wallet.address}（自荐卡 owner）`);
console.log(`📊 链上已有 ${count} 张自荐卡，本次写入 ${Object.keys(PROFILES).length} 份简历\n`);

const links = [];

for (const [idStr, profile] of Object.entries(PROFILES)) {
  const id = Number(idStr);
  const c = await scout.getCandidate(id);
  const full = { ...profile, ...(CONTACTS[id] ? { contact: CONTACTS[id] } : {}) };
  const json = JSON.stringify(full);
  const bytes = new TextEncoder().encode(json).length;

  if (c.owner.toLowerCase() !== wallet.address.toLowerCase()) {
    console.log(`⏭️  #${id} ${c.name} 的 owner 不是当前账户，跳过`);
    continue;
  }
  if (bytes > 2000) {
    console.log(`❌ #${id} ${c.name} 简历 ${bytes} 字节，超过 2000 上限，跳过`);
    continue;
  }

  // 已有简历就是"更新"（存储槽非零→非零，gas 便宜约 4 倍），否则是首次写入
  const isUpdate = await registry.hasProfile(id);
  const gasLimit = isUpdate ? gasForResumeUpdate(bytes) : gasForResume(bytes);
  const tx = await registry.setProfile(id, json, { gasLimit });
  await tx.wait();
  const h = keccak256(toUtf8Bytes(json));
  links.push({ id, name: c.name, hash: h, json, url: `${EXPLORER}/tx/${tx.hash}` });
  console.log(`✅ #${id} ${c.name} 简历${isUpdate ? "更新到 v2" : "上链"}（${bytes} 字节 · gasLimit ${gasLimit} · ${h.slice(0, 12)}…）`);
  console.log(`   ${EXPLORER}/tx/${tx.hash}`);
  await sleep(GAP);
}

console.log("\n🔐 链上校验自检：");
for (const l of links.slice(0, 3)) {
  const ok = await registry.verify(l.id, l.json);
  // 篡改要保证一定改变了内容：改名一个键名，比替换某个城市名稳妥（不同卡片城市不同）
  const bad = await registry.verify(l.id, l.json.replace('"role"', '"roleX"'));
  console.log(`   #${l.id} 原文校验=${ok ? "✅ 一致" : "❌ 不一致"} · 篡改后校验=${bad ? "❌ 竟然通过" : "✅ 正确识别为不一致"}`);
}

console.log("\n🚫 权限自检：非卡片 owner 不能写简历");
try {
  const { wallets } = readJson(path.join(ROOT, ".demo-wallets.json"));
  const outsider = new Wallet(wallets[0], provider);
  const outsiderRegistry = new Contract(dep.profileRegistry.address, artifact.abi, outsider);
  await outsiderRegistry.setProfile.staticCall(1, JSON.stringify({ role: "我不是这张卡的主人" }));
  console.log(`   ❌ 异常：${outsider.address} 竟然写成功了（权限校验失效）`);
} catch (e) {
  console.log(`   ✅ 被正确拒绝：${e.shortMessage ?? e.message}`);
}

console.log(`\n📊 小结：${links.length} 份简历已上链，全部可通过 registry.verify(cardId, json) 校验`);
console.log("👉 下一步: npm run serve 打开前端，点开卡片看「链上简历」");