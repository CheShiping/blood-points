import BloodPointsABI from "../contracts/BloodPoints.json";
import BloodPointTokenABI from "../contracts/BloodPointToken.json";
import { id } from "ethers";

/** Sepolia 测试网链参数 */
export const SEPOLIA_CHAIN_ID = 11155111;
export const SEPOLIA_CHAIN_ID_HEX = "0xaa36a7";
export const SEPOLIA_NETWORK_NAME = "Sepolia 测试网";
export const ETHERSCAN_TX_URL = "https://sepolia.etherscan.io/tx/";

/**
 * 只读 RPC 节点：优先读取环境变量 VITE_SEPOLIA_RPC_URL（frontend/.env），
 * 未配置时回退到默认节点（publicnode 公共节点，较免费 Key 更稳定）。
 * 未连接钱包时也可通过该节点读取链上数据。
 */
export const SEPOLIA_RPC_URL: string =
  import.meta.env.VITE_SEPOLIA_RPC_URL ||
  "https://ethereum-sepolia-rpc.publicnode.com";

/**
 * Sepolia 测试网已部署地址（2026-10-13，deploy-sepolia.ts + 收尾脚本部署）
 * - BloodPoints:      0x915b9e172d2905dc326c83739db040e08916390c
 * - BloodPointToken:  0x2c837224dd03b36910871c7f32f2dca8d2b0e9c0
 * 重新部署后需同步更新此处，并运行 npx hardhat run scripts/export-abi.ts
 */
export const BLOOD_POINTS_ADDRESS: string = "0x915b9e172d2905dc326c83739db040e08916390c";
export const BLOOD_POINT_TOKEN_ADDRESS: string = "0x2c837224dd03b36910871c7f32f2dca8d2b0e9c0";

/** 合约是否已配置地址 */
export const IS_CONTRACT_CONFIGURED =
  BLOOD_POINTS_ADDRESS !== "0x0000000000000000000000000000000000000000" &&
  BLOOD_POINT_TOKEN_ADDRESS !== "0x0000000000000000000000000000000000000000";

export const BLOOD_POINTS_ABI = BloodPointsABI;
export const BLOOD_POINT_TOKEN_ABI = BloodPointTokenABI;

/**
 * AccessControl 角色哈希（与合约中 keccak256("ROLE_NAME") 一致）
 */
export const ROLES = {
  COLLECTOR: id("COLLECTOR_ROLE"),
  BLOOD_BANK: id("BLOOD_BANK_ROLE"),
  LAB: id("LAB_ROLE"),
  HOSPITAL: id("HOSPITAL_ROLE"),
} as const;

/**
 * 前端写操作统一 gas 上限：
 * recordBlood 等函数需铸造 ERC20 并写入血液单元/里程碑字符串，实测约 1.6M gas，
 * 旧值 300000 会 out-of-gas 回退。未用完的 gas 不扣费，仅 revert 时按实际消耗收取。
 */
export const TX_GAS_LIMIT = 3000000n;
