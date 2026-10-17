// 用 solc 编译 contracts/*.sol → artifacts/*.json
// 运行: npm run compile
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import solc from "solc";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CONTRACTS = ["TalentScout", "ProfileRegistry"];

const sources = {};
for (const name of CONTRACTS) {
  sources[`${name}.sol`] = { content: fs.readFileSync(path.join(root, "contracts", `${name}.sol`), "utf8") };
}

function compileWith(evmVersion) {
  const input = {
    language: "Solidity",
    sources,
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion,
      outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
    },
  };
  return JSON.parse(solc.compile(JSON.stringify(input)));
}

let output = null;
let usedEvm = null;
let lastErr = null;
for (const evmVersion of ["osaka", "prague", "cancun"]) {
  let result;
  try {
    result = compileWith(evmVersion);
  } catch (e) {
    lastErr = String(e);
    continue;
  }
  const errors = (result.errors ?? []).filter((e) => e.severity === "error");
  const fatal = errors.filter((e) => !/Invalid EVM version/i.test(e.message));
  if (fatal.length) {
    console.error(fatal.map((e) => e.formattedMessage).join("\n"));
    process.exit(1);
  }
  if (errors.length === 0) { output = result; usedEvm = evmVersion; break; }
  lastErr = errors.map((e) => e.formattedMessage).join("\n");
}

if (!output) { console.error("❌ 编译失败：\n" + lastErr); process.exit(1); }

fs.mkdirSync(path.join(root, "artifacts"), { recursive: true });
for (const name of CONTRACTS) {
  const artifact = output.contracts[`${name}.sol`][name];
  fs.writeFileSync(path.join(root, "artifacts", `${name}.json`), JSON.stringify({
    contractName: name,
    solcVersion: solc.version(),
    evmVersion: usedEvm,
    abi: artifact.abi,
    bytecode: "0x" + artifact.evm.bytecode.object,
  }, null, 2));
  console.log(`📦 artifacts/${name}.json（bytecode ${artifact.evm.bytecode.object.length / 2} bytes）`);
}

console.log(`\n✅ 编译成功！solc ${solc.version()}，evmVersion = ${usedEvm}`);