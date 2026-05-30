import { network } from "hardhat";

const { viem } = await network.create({ network: "sepolia" });

const publicClient = await viem.getPublicClient();
const [deployer] = await viem.getWalletClients();

console.log("Deploying BloodPoints to Sepolia...");
console.log("Deployer address:", deployer.account.address);

const bloodPoints = await viem.deployContract("BloodPoints", [
  deployer.account.address,
]);

console.log("BloodPoints deployed to:", bloodPoints.address);
console.log("Owner:", await bloodPoints.read.owner());
