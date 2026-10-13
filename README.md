# 🩸 热血链 · 无偿献血公益透明追踪平台（BloodPoints）

> 课程《Web3技术应用》期末项目 —— 选题适配：**参考选题 8「公益捐赠透明追踪平台」**，
> 迁移至无偿献血公益场景：捐赠者（献血者）的每一次捐赠按**里程碑状态机**分阶段推进，
> 每个阶段的操作人、机构与 **IPFS 凭证哈希**全部上链公示，捐款（血液）流向全程可查；
> 捐赠奖励以 **ERC20 积分代币 BPT** 发放，商城兑换时链上销毁。

**教学模拟声明：** 本项目仅用于课程教学演示，只部署 Sepolia 测试网，不涉及任何真实资产、
真实资金或主网部署；代码中不含真实私钥与助记词。

## 项目简介

- **双合约架构**：`BloodPointToken`（ERC20 积分代币，OpenZeppelin）+ `BloodPoints`（公益追踪平台合约）
- **ERC20 标准**：积分即代币（名称 BloodPointToken，符号 BPT，0 位小数），支持转账、授权、暂停
- **里程碑状态机**：献血 → 血站接收 → 实验室检测 → 医院分配，每步留存操作人、机构、IPFS 凭证 CID 与时间戳
- **多角色权限**：基于 OpenZeppelin `AccessControl`，采集记录员 / 血站 / 实验室 / 医院 / 管理员五类角色
- **ethers.js 前端**：ConnectKit 钱包连接弹窗、网络检测（Sepolia）、链上数据读取、多个写操作与交易状态提示

> 📄 区块链特性详细说明请参阅 [BLOCKCHAIN.md](./BLOCKCHAIN.md)

## 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 智能合约 | Solidity 0.8.28 | 合约语言 |
| 开发框架 | Hardhat 3 | 编译、测试、部署 |
| 合约库 | OpenZeppelin 5.6.1 | ERC20 / AccessControl / Pausable / ReentrancyGuard |
| 测试 | Hardhat + Node Test Runner（viem） | 52 个单元测试 |
| 前端框架 | React 19 + TypeScript | SPA 应用 |
| 钱包连接 | **ConnectKit**（wagmi + viem） | 钱包选择弹窗、连接/断开、网络切换 |
| 链上交互 | **ethers.js v6** | 合约读取（JsonRpcProvider）与写操作（Signer） |
| 目标网络 | Sepolia 测试网 | 以太坊 L1 测试链 |

## 项目结构

```
blood-points/
├── contracts/
│   ├── BloodPoints.sol           # 平台主合约（AccessControl + 里程碑状态机 + ERC20 集成）
│   └── BloodPointToken.sol       # ERC20 积分代币（Ownable + Pausable + minter）
├── test/
│   ├── BloodPoints.ts            # 平台合约测试（37 个用例）
│   └── BloodPointToken.ts        # 代币合约测试（15 个用例）
├── scripts/
│   ├── deploy.ts                 # 本地部署（代币 + 平台 + 移交 minter + 示例商品）
│   ├── deploy-sepolia.ts         # Sepolia 部署脚本
│   ├── export-abi.ts             # 导出 ABI 到前端（两个合约）
│   └── assign-roles.ts           # AccessControl 角色分配脚本
├── frontend/
│   └── src/
│       ├── components/           # React 组件（WalletConnect / DonorPanel / CollectorPanel / BloodBankPanel / Leaderboard / PointsRing / TxFeedback）
│       ├── wallet/WalletContext.tsx   # ConnectKit(wagmi) → ethers.js 桥接：账户/链状态 + Signer 派生
│       ├── hooks/useContract.ts      # 合约读取 Hook 与写操作状态机
│       ├── config/contracts.ts       # 合约地址 / ABI / 角色哈希 / RPC
│       ├── config/wagmi.ts           # ConnectKit 底层 wagmi 配置（Sepolia + injected）
│       └── contracts/                # 合约 ABI JSON（export-abi.ts 生成）
├── hardhat.config.ts
└── README.md
```

## 多方角色与权限（AccessControl）

| 角色 | 角色标识 | 职责 | 链上权限 |
|------|----------|------|----------|
| **平台管理员** | `DEFAULT_ADMIN_ROLE` | 系统管理 | 角色授权/撤销、上架商品、应急暂停、更换代币地址 |
| **采集记录员** | `COLLECTOR_ROLE` | 现场采血登记 | `recordBlood`（为献血者发放 100 BPT） |
| **血站工作人员** | `BLOOD_BANK_ROLE` | 血液入库 | `receiveBlood` |
| **检测实验室** | `LAB_ROLE` | 质量检测 | `testBlood` |
| **医院工作人员** | `HOSPITAL_ROLE` | 临床用血 | `assignToPatient` |
| **献血者** | 普通用户 | 献血 | `donateBlood`（自助献血获 100 BPT）、积分转账（ERC20 `transfer`）、兑换商品 |

### 业务流程（里程碑状态机）

```
┌──────────┐   ┌──────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────┐
│  献血者   │──▶│ 采集记录员 │──▶│ 血站接收      │──▶│ 实验室检测    │──▶│ 医院分配  │
│donateBlood│   │recordBlood│   │receiveBlood  │   │testBlood     │   │assignTo… │
└──────────┘   └──────────┘   └──────────────┘   └──────────────┘   └──────────┘
   100 BPT        100 BPT         入库凭证 CID        检测报告 CID        用血凭证 CID
   铸造发放        铸造发放        里程碑上链          里程碑上链          里程碑上链
```

每个阶段流转都会写入 `Milestone{stage, operator, location, evidence, timestamp}` 并发出
`MilestoneRecorded` 事件，前端可通过 `getBloodJourney(bloodId)` 一站式查询完整旅程。

## 快速开始

### 前置条件

- Node.js >= 18
- MetaMask 浏览器插件
- Sepolia 测试网 ETH（部署与演示用，可从水龙头获取）

### 1. 安装依赖

```bash
# 根目录（Hardhat）
npm install

# 前端
cd frontend
npm install
cd ..
```

### 2. 环境配置

在根目录创建 `.env` 文件（参考 `.env.example`，**切勿提交到 Git**）：

```env
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
DEPLOYER_PRIVATE_KEY=你的部署钱包私钥
ETHERSCAN_API_KEY=你的 Etherscan API Key
```

> 前端只读 RPC 可在 `frontend/.env` 中配置 `VITE_SEPOLIA_RPC_URL`（可选，未配置时使用默认节点）。

### 3. 编译与测试

```bash
npx hardhat compile
npx hardhat test        # 预期：52 个测试全部通过
```

### 4. 部署合约

**本地部署（开发测试）：**

```bash
npx hardhat node                                        # 终端 1：启动本地节点
npx hardhat run scripts/deploy.ts --network localhost   # 终端 2：部署
```

**Sepolia 测试网部署：**

```bash
npx hardhat run scripts/deploy-sepolia.ts --network sepolia
```

部署脚本会自动完成：部署 `BloodPointToken` → 部署 `BloodPoints` → 将代币 `minter`
移交给平台合约 → 上架 3 个示例商品，并输出两个合约地址。

### 5. 配置前端

将部署输出的地址填入 `frontend/src/config/contracts.ts`：

```ts
export const BLOOD_POINTS_ADDRESS = "0x平台合约地址" as const;
export const BLOOD_POINT_TOKEN_ADDRESS = "0x代币合约地址" as const;
```

### 6. 导出 ABI 并分配角色

```bash
npx hardhat run scripts/export-abi.ts

# 修改 scripts/assign-roles.ts 中的地址后执行：
npx hardhat run scripts/assign-roles.ts --network sepolia
```

### 7. Etherscan 源码验证

```bash
npx hardhat verify --network sepolia <BloodPoints地址> <管理员地址> <代币地址>
npx hardhat verify --network sepolia <代币地址> <管理员地址> <平台合约地址>
```

### 8. 启动前端

```bash
cd frontend
npm run dev
```

访问 http://localhost:5173 ，连接 MetaMask 并切换到 Sepolia 测试网。

## 合约核心功能

| 功能 | 函数 | 权限 |
|------|------|------|
| 自助献血 | `donateBlood(bloodType, volume)` | 任意用户（未暂停） |
| 采集登记 | `recordBlood(donor, bloodType, volume, evidence)` | COLLECTOR_ROLE |
| 血站接收 | `receiveBlood(bloodId, bloodBank, evidence)` | BLOOD_BANK_ROLE |
| 实验室检测 | `testBlood(bloodId, passed, evidence)` | LAB_ROLE |
| 医院分配 | `assignToPatient(bloodId, patient, evidence)` | HOSPITAL_ROLE |
| 积分转账 | ERC20 `transfer(to, amount)` | 代币持有者 |
| 商品兑换 | `redeemProduct(productId)` | 任意用户（CEI + nonReentrant，销毁 BPT） |
| 应急暂停 | `pause()` / `unpause()` | DEFAULT_ADMIN_ROLE |
| 排行榜 | `getLeaderboard()` | 只读 |
| 血液旅程 | `getBloodJourney(bloodId)` / `getMilestones(bloodId)` | 只读 |

## 已部署合约（Sepolia 测试网）

| 合约 | 地址 | Etherscan（源码已验证） |
|------|------|----------|
| BloodPoints（平台） | `0x915b9e172d2905dc326c83739db040e08916390c` | [查看](https://sepolia.etherscan.io/address/0x915b9e172d2905dc326c83739db040e08916390c) |
| BloodPointToken（ERC20） | `0x2c837224dd03b36910871c7f32f2dca8d2b0e9c0` | [查看](https://sepolia.etherscan.io/address/0x2c837224dd03b36910871c7f32f2dca8d2b0e9c0) |

- 部署账户：`0x60780f39004283358d1d82820966f57104b2827f`（平台管理员 DEFAULT_ADMIN_ROLE）
- 源码验证：Etherscan + Sourcify 双平台已验证通过（`npx hardhat verify`）
- 代币 minter 已指向平台合约；已上架 3 个示例商品（献血纪念T恤 200 / 爱心礼盒 500 / 免费体检券 1000）
- 前端 `src/config/contracts.ts` 已配置上述地址，`npm run dev` 即可连接 Sepolia 演示
- 角色授权：修改 `scripts/assign-roles.ts` 中的地址后运行 `npx hardhat run scripts/assign-roles.ts --network sepolia`（献血者功能无需角色即可使用）

## 测试覆盖（52 个用例）

```
BloodPoints（37）
├── Points System (ERC20)  积分铸造、累加、排行榜、兑换销毁
├── Blood Tracking         血液单元、里程碑（操作人/机构/证据）、事件
├── State Machine Validation  非法状态跳转、重复分配、不存在 ID、无效输入
├── Access Control         越权调用（×7）、授权/撤销、hasRole
├── Pausable (Emergency)   暂停阻断献血/兑换、血液流转不受影响
├── Product Management     上架、兑换、库存、异常输入
└── Blood Query Functions  按血型/状态/ID 查询

BloodPointToken（15）
├── Metadata               名称/符号/0 位小数/minter
├── Minting & Burning      平台铸造销毁、非 minter 拒绝（权限/安全）
├── Pausable               暂停阻断转账、非 owner 拒绝暂停
└── Minter management      setMinter 权限与零地址校验
```

其中权限、异常、安全场景测试共 20+ 个，满足考试要求（≥8 个用例且 ≥2 个权限/异常/安全场景）。

## 已知限制与说明

- **排行榜 gas**：`getLeaderboard()` 使用链上冒泡排序，献血者规模大时 gas 较高，教学规模可接受。
- **IPFS 上传**：凭证 CID 由使用方在上链前自行上传至 IPFS/Pinata 获得（考试要求中 IPFS 为可选项），合约只负责哈希上链公示。
- **Sepolia 网络不可达时**：按考试规则可在 Hardhat 本地网络演示，并在项目报告中说明原因。

## 许可证

MIT License
