import { network } from "hardhat";
import { keccak256, toBytes } from "viem";

// 与 contracts/BloodPoints.sol 中的角色常量保持一致
const COLLECTOR_ROLE = keccak256(toBytes("COLLECTOR_ROLE"));
const BLOOD_BANK_ROLE = keccak256(toBytes("BLOOD_BANK_ROLE"));
const LAB_ROLE = keccak256(toBytes("LAB_ROLE"));
const HOSPITAL_ROLE = keccak256(toBytes("HOSPITAL_ROLE"));

const { viem } = await network.create({ network: "sepolia" });

// TODO: 部署后把地址改成新的 BloodPoints 合约地址
const contract = await viem.getContractAt("BloodPoints", "0x762a3de172619d3f7879d033966d31081a426aa2");

const [admin] = await viem.getWalletClients();
console.log("Admin (DEFAULT_ADMIN_ROLE):", admin.account.address);
console.log("Contract:", contract.address);
console.log("");

// 采集记录员（示例地址，按需修改）
const collectorAddr = "0x710A88EA795e03674cEB2909D2ae0A04F12aD3C8";
await contract.write.grantRole([COLLECTOR_ROLE, collectorAddr]);
console.log("✅ COLLECTOR_ROLE ->", collectorAddr);

// 血站工作人员
const bloodBank1 = "0x0d41B247768400985AE1C86Dd37441635c025b2A";
await contract.write.grantRole([BLOOD_BANK_ROLE, bloodBank1]);
console.log("✅ BLOOD_BANK_ROLE ->", bloodBank1);

// 检测实验室
const labAddr = "0x1cBE93D82a0aB15FBC607D4d1DC9184E8ed09E43";
await contract.write.grantRole([LAB_ROLE, labAddr]);
console.log("✅ LAB_ROLE ->", labAddr);

// 医院工作人员（示例地址，按需修改）
const hospitalAddr = "0x5F708e82A052dd7835f3913573D706809B6C3030";
if (hospitalAddr !== "0x5F708e82A052dd7835f3913573D706809B6C3030") {
  await contract.write.grantRole([HOSPITAL_ROLE, hospitalAddr]);
  console.log("✅ HOSPITAL_ROLE ->", hospitalAddr);
}

console.log("\nDone! Roles granted (AccessControl).");
