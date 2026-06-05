import { network } from "hardhat";

const { viem } = await network.create({ network: "sepolia" });

const contract = await viem.getContractAt("BloodPoints", "0x762a3de172619d3f7879d033966d31081a426aa2");

// 采集记录员
const collectorAddr = "0x0d41B247768400985AE1C86Dd37441635c025b2A";
await contract.write.assignRole([collectorAddr, 1]); // Role.Collector = 1
console.log("✅ Collector role assigned to:", collectorAddr);

// 血站工作人员 #1
const bloodBank1 = "0xfd6cc37556D7ff638dF35d010b37b69f51c99a5B";
await contract.write.assignRole([bloodBank1, 2]); // Role.BloodBank = 2
console.log("✅ BloodBank role assigned to:", bloodBank1);

// 血站工作人员 #2
const bloodBank2 = "0x710A88EA795e03674cEB2909D2ae0A04F12aD3C8";
await contract.write.assignRole([bloodBank2, 2]); // Role.BloodBank = 2
console.log("✅ BloodBank role assigned to:", bloodBank2);

// 先撤销 Owner 之前的角色（如果有的话）
const [owner] = await viem.getWalletClients();
await contract.write.revokeRole([owner.account.address]);
console.log("✅ Owner role revoked (owner only needs admin, not Collector/BloodBank)");

console.log("\nDone! Roles assigned:");
console.log("  Collector:  ", collectorAddr);
console.log("  BloodBank:  ", bloodBank1);
console.log("  BloodBank:  ", bloodBank2);
console.log("  Donors:     use donateBlood directly (no role needed)");
