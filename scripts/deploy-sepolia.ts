import { network } from "hardhat";

const { viem } = await network.create({ network: "sepolia" });

const publicClient = await viem.getPublicClient();
const [deployer] = await viem.getWalletClients();

console.log("Deploying BloodPoints platform to Sepolia...");
console.log("Deployer address:", deployer.account.address);
console.log("Chain ID:", await publicClient.getChainId());
console.log("");

// 1. 部署积分代币（ERC20）
console.log("Deploying BloodPointToken (ERC20)...");
const token = await viem.deployContract("BloodPointToken", [
  deployer.account.address,
  deployer.account.address,
]);
console.log("BloodPointToken deployed to:", token.address);

// 2. 部署平台合约
console.log("Deploying BloodPoints platform...");
const bloodPoints = await viem.deployContract("BloodPoints", [
  deployer.account.address,
  token.address,
]);
console.log("BloodPoints deployed to:", bloodPoints.address);

// 3. minter 移交给平台合约
console.log("Setting minter to platform contract...");
await token.write.setMinter([bloodPoints.address]);
console.log("Minter:", await token.read.minter());

// 4. 上架示例商品
console.log("Adding sample products...");
await bloodPoints.write.addNewProduct(["献血纪念T恤", 200, 50]);
await bloodPoints.write.addNewProduct(["爱心礼盒", 500, 20]);
await bloodPoints.write.addNewProduct(["免费体检券", 1000, 10]);
console.log("nextProductId:", (await bloodPoints.read.nextProductId()).toString());

console.log("\n=== Deployment Summary ===");
console.log("BloodPoints:", bloodPoints.address);
console.log("BloodPointToken:", token.address);
console.log("\nNext steps:");
console.log("  1. Verify on Etherscan (see README for commands)");
console.log("  2. Update frontend/src/config/contracts.ts");
console.log("  3. Run: npx hardhat run scripts/export-abi.ts");
console.log("  4. Run: npx hardhat run scripts/assign-roles.ts");
