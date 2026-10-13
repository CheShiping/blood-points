import { network } from "hardhat";

async function main() {
  console.log("=== BloodPoints 公益追踪平台部署脚本 ===\n");

  const { viem } = await network.create();
  const publicClient = await viem.getPublicClient();
  const [deployer] = await viem.getWalletClients();

  console.log("部署者地址:", deployer.account.address);
  console.log("网络 Chain ID:", await publicClient.getChainId());
  console.log("");

  // 1. 部署积分代币（ERC20），minter 先设为部署者，稍后切换为平台合约
  console.log("正在部署 BloodPointToken (ERC20) 合约...");
  const token = await viem.deployContract("BloodPointToken", [
    deployer.account.address,
    deployer.account.address,
  ]);
  console.log("✅ BloodPointToken 部署成功:", token.address);

  // 2. 部署平台合约
  console.log("正在部署 BloodPoints 平台合约...");
  const bloodPoints = await viem.deployContract("BloodPoints", [
    deployer.account.address,
    token.address,
  ]);
  console.log("✅ BloodPoints 部署成功:", bloodPoints.address);

  // 3. 将积分代币的铸币/销毁权限移交给平台合约
  console.log("正在将 minter 权限移交给平台合约...");
  await token.write.setMinter([bloodPoints.address]);
  console.log("✅ minter =", await token.read.minter());

  // 4. 上架示例商品
  console.log("正在上架示例商品...");
  await bloodPoints.write.addNewProduct(["献血纪念T恤", 200, 50]);
  await bloodPoints.write.addNewProduct(["爱心礼盒", 500, 20]);
  await bloodPoints.write.addNewProduct(["免费体检券", 1000, 10]);
  console.log("✅ 已上架 3 个示例商品，nextProductId =", await bloodPoints.read.nextProductId());

  // 5. 部署验证
  console.log("\n=== 部署验证 ===");
  console.log("平台管理员 (DEFAULT_ADMIN_ROLE):", deployer.account.address);
  console.log("积分代币地址:", token.address);
  console.log("代币名称/符号:", await token.read.name(), "/", await token.read.symbol());
  console.log("每次献血积分:", (await bloodPoints.read.POINTS_PER_DONATION()).toString());
  console.log("暂停状态:", await bloodPoints.read.paused());

  console.log("\n=== 部署完成 ===");
  console.log("BloodPoints 合约地址:", bloodPoints.address);
  console.log("BloodPointToken 合约地址:", token.address);
  console.log("\n下一步：");
  console.log("  1. 更新 frontend/src/config/contracts.ts 中的合约地址");
  console.log("  2. 运行 npx hardhat run scripts/export-abi.ts 导出 ABI");
  console.log("  3. 运行 npx hardhat run scripts/assign-roles.ts 分配业务角色");
}

main().catch((error) => {
  console.error("部署失败:", error);
  process.exit(1);
});
