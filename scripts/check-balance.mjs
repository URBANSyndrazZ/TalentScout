import dotenv from "dotenv";
import { JsonRpcProvider, Wallet, formatEther } from "ethers";
dotenv.config({ quiet: true });
const pk = (process.env.PRIVATE_KEY ?? "").trim();
if (!pk) { console.log("NO_KEY"); process.exit(0); }
const provider = new JsonRpcProvider(process.env.RPC_URL ?? "https://testnet-rpc.monad.xyz");
const w = new Wallet(pk, provider);
const bal = await provider.getBalance(w.address);
console.log("address:", w.address);
console.log("balance:", formatEther(bal), "MON");
console.log("has_enough:", bal > 10_000_000_000_000_000n /* 0.01 MON */);