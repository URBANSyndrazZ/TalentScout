// 部署脚本共用的配置读写：artifacts → frontend/contract.config.js、deployments.json
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const DEPLOYMENTS = path.join(ROOT, "deployments.json");

export const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
export const readArtifact = (name) => {
  const p = path.join(ROOT, "artifacts", `${name}.json`);
  if (!fs.existsSync(p)) {
    console.error(`❌ 缺少 artifacts/${name}.json，先运行：npm run compile`);
    process.exit(1);
  }
  return readJson(p);
};

/// 生成前端配置：window.TALENTSCOUT = { ..., contractAddress, abi, profile? }
export function writeContractConfig({ chainId, rpcUrl, explorer, scout, profile }) {
  const cfg = {
    chainId,
    rpcUrl,
    explorer,
    contractAddress: scout,
    abi: readArtifact("TalentScout").abi,
  };
  if (profile) cfg.profile = { address: profile, abi: readArtifact("ProfileRegistry").abi };

  fs.writeFileSync(
    path.join(ROOT, "frontend", "contract.config.js"),
    `// 由 npm run deploy / npm run deploy-profile 自动生成（请勿手改）\nwindow.TALENTSCOUT = ${JSON.stringify(cfg, null, 2)};\n`
  );
}

/// 合并式写入 deployments.json（保留此前部署的其它合约信息；removeKeys 用于清掉已失效的条目）
export function patchDeployments(patch, removeKeys = []) {
  const cur = fs.existsSync(DEPLOYMENTS) ? readJson(DEPLOYMENTS) : {};
  for (const k of removeKeys) delete cur[k];
  fs.writeFileSync(DEPLOYMENTS, JSON.stringify({ ...cur, ...patch }, null, 2));
}