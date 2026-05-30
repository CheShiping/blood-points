import { network } from "hardhat";

async function main() {
  console.log("=== BloodPoints 合约部署脚本 ===\n");

  const { viem } = await network.create();
  const publicClient = await viem.getPublicClient();
  const [deployer] = await viem.getWalletClients();

  console.log("部署者地址:", deployer.account.address);
  console.log("网络 Chain ID:", await publicClient.getChainId());
  console.log("");

  console.log("正在部署 BloodPoints 合约...");
  const bloodPoints = await viem.deployContract("BloodPoints", [
    deployer.account.address,
  ]);

  console.log("✅ BloodPoints 部署成功!");
  console.log("合约地址:", bloodPoints.address);
  console.log("");

  console.log("正在验证合约部署...");
  const owner = await bloodPoints.read.owner();
  const nextProductId = await bloodPoints.read.nextProductId();
  const pointsPerDonation = await bloodPoints.read.POINTS_PER_DONATION();

  console.log("合约 Owner:", owner);
  console.log("下一个商品 ID:", nextProductId.toString());
  console.log("每次献血积分:", pointsPerDonation.toString());
  console.log("");

  if (owner.toLowerCase() === deployer.account.address.toLowerCase()) {
    console.log("✅ 合约验证通过 - Owner 地址正确");
  } else {
    console.log("❌ 合约验证失败 - Owner 地址不匹配");
    process.exit(1);
  }

  console.log("\n=== 部署完成 ===");
  console.log("合约地址:", bloodPoints.address);
}

main().catch((error) => {
  console.error("部署失败:", error);
  process.exit(1);
});
