import { network } from "hardhat";
import { keccak256, toBytes } from "viem";

// 与 contracts/BloodPoints.sol 中的角色常量保持一致
const COLLECTOR_ROLE = keccak256(toBytes("COLLECTOR_ROLE"));
const BLOOD_BANK_ROLE = keccak256(toBytes("BLOOD_BANK_ROLE"));
const LAB_ROLE = keccak256(toBytes("LAB_ROLE"));
const HOSPITAL_ROLE = keccak256(toBytes("HOSPITAL_ROLE"));

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const { viem } = await network.create({ network: "sepolia" });

// BloodPoints 平台合约（Sepolia，2026-10-13 部署）
const contract = await viem.getContractAt("BloodPoints", "0x915b9e172d2905dc326c83739db040e08916390c");

const [admin] = await viem.getWalletClients();
console.log("Admin (DEFAULT_ADMIN_ROLE):", admin.account.address);
console.log("Contract:", contract.address);
console.log("");

/**
 * 授权角色（带间隔与重试）：
 * 公共 RPC 节点的 mempool 视图可能滞后，同脚本连续两笔会被误判为
 * "replacement transaction underpriced"，故每笔之间留出间隔。
 */
async function grant(role: `0x${string}`, label: string, account: string) {
  if (await contract.read.hasRole([role, account as `0x${string}`])) {
    console.log(`⏭️  ${label} 已有角色，跳过: ${account}`);
    return;
  }
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await contract.write.grantRole([role, account as `0x${string}`]);
      console.log(`✅ ${label} -> ${account}`);
      return;
    } catch (err) {
      console.log(`  [${label}] 第 ${attempt}/3 次失败: ${(err as Error).message.slice(0, 100)}`);
      if (attempt === 3) throw err;
      await sleep(20000 * attempt);
    }
  }
}

// 采集记录员
await grant(COLLECTOR_ROLE, "COLLECTOR_ROLE", "0x710A88EA795e03674cEB2909D2ae0A04F12aD3C8");
await sleep(20000);

// 血站工作人员
await grant(BLOOD_BANK_ROLE, "BLOOD_BANK_ROLE", "0x0d41B247768400985AE1C86Dd37441635c025b2A");
await sleep(20000);

// 检测实验室
await grant(LAB_ROLE, "LAB_ROLE", "0x1cBE93D82a0aB15FBC607D4d1DC9184E8ed09E43");
await sleep(20000);

// 医院工作人员
await grant(HOSPITAL_ROLE, "HOSPITAL_ROLE", "0x5F708e82A052dd7835f3913573D706809B6C3030");

console.log("\nDone! Roles granted (AccessControl).");
