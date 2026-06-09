# 🩸 BloodPoints（热血链）

基于区块链的献血积分管理系统 —— 让每一滴热血都有迹可循

## 项目简介

BloodPoints 是一个部署在以太坊 Sepolia 测试网上的去中心化应用（DApp），旨在通过区块链技术实现献血积分的透明管理与血液全流程追踪。

> 📄 区块链特性详细说明请参阅 [BLOCKCHAIN.md](./BLOCKCHAIN.md)

**核心价值：**
- 献血者获得链上积分奖励，积分可转赠、可兑换商品
- 血液从采集到分配的全流程上链，实现不可篡改的溯源追踪
- 多角色协作（采集员、血站、献血者），权限清晰、各司其职

## 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 智能合约 | Solidity 0.8.28 | 合约语言 |
| 开发框架 | Hardhat 3 | 编译、测试、部署 |
| 合约库 | OpenZeppelin 5.6.1 | Ownable、ReentrancyGuard |
| 前端框架 | React 19 + TypeScript | SPA 应用 |
| 构建工具 | Vite | 前端构建 |
| 链上交互 | wagmi + viem | React hooks + 以太坊客户端 |
| 钱包连接 | RainbowKit | 多钱包支持 |
| 目标网络 | Sepolia 测试网 | 以太坊 L1 测试链 |

## 项目结构

```
final-exam/
├── contracts/
│   └── BloodPoints.sol          # 核心智能合约
├── test/
│   └── BloodPoints.ts           # 合约测试（31 个用例）
├── scripts/
│   ├── deploy.ts                # 本地部署脚本
│   ├── deploy-sepolia.ts        # Sepolia 部署脚本
│   ├── export-abi.ts            # 导出 ABI 到前端
│   └── assign-roles.ts          # 角色分配脚本
├── frontend/
│   └── src/
│       ├── components/          # React 组件
│       │   ├── WalletConnect.tsx   # 钱包连接 + 导航
│       │   ├── DonorPanel.tsx      # 献血人员面板
│       │   ├── CollectorPanel.tsx  # 采集记录员面板
│       │   └── BloodBankPanel.tsx  # 血站工作人员面板
│       ├── config/wagmi.ts      # wagmi 配置
│       └── contracts/           # 合约 ABI + 地址
├── hardhat.config.ts            # Hardhat 配置
├── package.json
└── README.md
```

## 多方角色与权限

### 角色一览

| 角色 | 标识 | 职责 | 链上权限 |
|------|------|------|----------|
| **管理员 (Owner)** | `onlyOwner` | 系统管理 | 分配/撤销角色、上架商品 |
| **采集记录员 (Collector)** | `Role.Collector` | 现场采血 | 录入献血记录 (`recordBlood`) |
| **血站工作人员 (BloodBank)** | `Role.BloodBank` | 血液处理 | 接收、检测、分配血液 |
| **献血者 (Donor)** | 普通用户 | 献血 | 献血获积分、转赠、兑换 |
| **病人 (Patient)** | 被动角色 | 接收血液 | 通过地址记录血液来源 |

### 业务流程

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  献血者   │───▶│ 采集记录员 │───▶│ 血站接收  │───▶│ 血液检测  │
│ donateBlood│   │recordBlood│   │receiveBlood│  │ testBlood │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
                                                      │
                                                      ▼
                                               ┌──────────┐
                                               │ 分配病人  │
                                               │assignToPatient│
                                               └──────────┘
```

## 快速开始

### 前置条件

- Node.js >= 18
- MetaMask 浏览器插件
- Sepolia 测试网 ETH（用于部署和测试）

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

在根目录创建 `.env` 文件：

```env
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
SEPOLIA_PRIVATE_KEY=你的钱包私钥
```

### 3. 编译合约

```bash
npx hardhat compile
```

### 4. 运行测试

```bash
npx hardhat test
```

预期输出：31 个测试全部通过

### 5. 部署合约

**本地部署（开发测试）：**

```bash
npx hardhat node                              # 启动本地节点
npx hardhat run scripts/deploy.ts --network localhost
```

**Sepolia 测试网部署：**

```bash
npx hardhat run scripts/deploy-sepolia.ts --network sepolia
```

### 6. 导出 ABI 到前端

```bash
npx hardhat run scripts/export-abi.ts
```

### 7. 分配角色

部署后需要为不同地址分配角色：

```bash
# 修改 scripts/assign-roles.ts 中的地址，然后执行：
npx hardhat run scripts/assign-roles.ts --network sepolia
```

### 8. 启动前端

```bash
cd frontend
npm run dev
```

访问 http://localhost:5173

### 9. 前端配置

修改 `frontend/src/contracts/config.ts` 中的合约地址为最新部署地址：

```ts
export const CONTRACT_ADDRESS = "0x你的合约地址" as const;
```

## 合约核心功能

| 功能 | 函数 | 说明 |
|------|------|------|
| 献血获积分 | `donateBlood(bloodType, volume)` | 献血者直接调用，获得 100 积分 |
| 采集记录 | `recordBlood(donor, bloodType, volume)` | 采集员为献血者录入记录 |
| 接收血液 | `receiveBlood(bloodId, bloodBank)` | 血站接收血液 |
| 检测血液 | `testBlood(bloodId, passed)` | 血站提交检测结果 |
| 分配病人 | `assignToPatient(bloodId, patient)` | 将合格血液分配给病人 |
| 积分转赠 | `transferPoints(to, amount)` | 用户间积分转赠 |
| 商品兑换 | `redeemProduct(productId)` | 积分兑换商品 |
| 排行榜 | `getLeaderboard()` | 按积分排序的献血者榜单 |
| 血液追踪 | `getBloodJourney(bloodId)` | 查询血液完整流转记录 |

## 已部署合约

- **网络：** Sepolia 测试网
- **合约地址：** `0x762a3de172619d3f7879d033966d31081a426aa2`
- **区块浏览器：** [Etherscan 查看](https://sepolia.etherscan.io/address/0x762a3de172619d3f7879d033966d31081a426aa2)

## 测试覆盖

```
BloodPoints
  ├── Points System (7 tests)
  │   ├── 每次献血获得 100 积分
  │   ├── 多次献血积分累加
  │   ├── 首次献血进入排行榜
  │   ├── 重复献血不重复记录
  │   ├── 积分转赠
  │   ├── 拒绝转赠给自己
  │   └── 拒绝积分不足的转赠
  ├── Blood Tracking (6 tests)
  │   ├── 献血创建血液单元
  │   ├── 追踪献血者血液 ID
  │   ├── 单血站完整流转
  │   ├── 多血站流转
  │   ├── 查询血液完整旅程
  │   └── 追踪病人血液来源
  ├── State Machine Validation (6 tests)
  │   ├── 拒绝跳过接收直接检测
  │   ├── 拒绝跳过检测直接分配
  │   ├── 拒绝检测不合格后分配
  │   ├── 拒绝已检测血液重复接收
  │   ├── 拒绝已分配血液重复接收
  │   └── 拒绝重复分配
  ├── Access Control (7 tests)
  │   ├── 非 BloodBank 拒绝接收
  │   ├── 非 BloodBank 拒绝检测
  │   ├── 非 BloodBank 拒绝分配
  │   ├── 非 Collector 拒绝录入
  │   ├── BloodBank 完整操作
  │   ├── Collector 录入操作
  │   └── Owner 角色管理
  ├── Collector Functionality (3 tests)
  └── Blood Query Functions (3 tests)
```

## 答辩 PPT 预览

PPT 位于 `design-demos/` 目录，浏览器打开 `design-demos/index.html` 即可演示（← → 键翻页，ESC 回概览）。

```
┌─────────────────────────────────────────────────────────────┐
│  🩸 BloodPoints · 热血链                                      │
│  基于区块链的献血积分管理系统                                      │
│  ───────────────────────────────────────────                  │
│  Solidity · Hardhat · React · Sepolia                         │
└─────────────────────────────────────────────────────────────┘
  ① 封面

┌─────────────────────────────────────────────────────────────┐
│  项目概述                                                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐        │
│  │🔗去中心化 │ │🛡️不可篡改│ │🔍可追溯  │ │🤝多方协作│        │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘        │
│  BloodPoints 部署在以太坊 Sepolia 测试网，通过区块链技术实现       │
│  献血积分的透明管理与血液全流程追踪。                             │
└─────────────────────────────────────────────────────────────┘
  ② 项目概述

┌─────────────────────────────────────────────────────────────┐
│  项目分工 · 多方角色设计                                        │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐                         │
│  │👑  │ │📝  │ │🏥  │ │💉  │ │🛏️  │                         │
│  │管理│ │采集│ │血站│ │献血│ │病人│                         │
│  │员  │ │员  │ │人员│ │者  │ │    │                         │
│  └────┘ └────┘ └────┘ └────┘ └────┘                         │
│  5 个角色，权限由智能合约 onlyRole 强制执行                       │
└─────────────────────────────────────────────────────────────┘
  ③ 项目分工

┌─────────────────────────────────────────────────────────────┐
│  功能详解 · 智能合约                                           │
│  ┌─────────────────┐  ┌────────────────────────────────┐    │
│  │ 核心函数         │  │ 血液状态机                      │    │
│  │ · donateBlood    │  │                                │    │
│  │ · recordBlood    │  │ Donated → Received → Tested    │    │
│  │ · receiveBlood   │  │   已献血    血站接收    已检测   │    │
│  │ · testBlood      │  │                    ↓           │    │
│  │ · assignToPatient│  │                Assigned        │    │
│  │ · transferPoints │  │                 已分配          │    │
│  └─────────────────┘  └────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
  ④ 功能详解·合约

┌─────────────────────────────────────────────────────────────┐
│  功能详解 · 前端交互                                           │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐                  │
│  │💉献血人员  │ │📝采集记录员│ │🏥血站工作台│                  │
│  │· 积分查看  │ │· 输入地址  │ │· 血液列表  │                  │
│  │· 血液追踪  │ │· 选择血型  │ │· 接收血液  │                  │
│  │· 积分转赠  │ │· 选择血量  │ │· 检测血液  │                  │
│  │· 商品兑换  │ │· 上传链上  │ │· 分配病人  │                  │
│  └───────────┘ └───────────┘ └───────────┘                  │
└─────────────────────────────────────────────────────────────┘
  ⑤ 功能详解·前端

┌─────────────────────────────────────────────────────────────┐
│  测试覆盖                                                     │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐                                │
│  │ 31 │ │  6 │ │100%│ │Hard│                                │
│  │用例│ │分组│ │通过│ │hat │                                │
│  └────┘ └────┘ └────┘ └────┘                                │
│  积分系统(7) · 状态机(6) · 血液追踪(6) · 权限控制(7)           │
└─────────────────────────────────────────────────────────────┘
  ⑥ 测试覆盖

┌─────────────────────────────────────────────────────────────┐
│  总结与展望                                                   │
│  ✅ 完整区块链应用  ✅ 5角色协作  ✅ 状态机驱动                  │
│  ✅ 31个测试用例    ✅ 角色化前端                               │
│  ────────────────────────────────────                        │
│  🔮 未来：Chainlink预言机 / NFT献血证书 / 联盟链扩展            │
│  📍 已部署: 0x762a3de...aa2 (Sepolia)                         │
└─────────────────────────────────────────────────────────────┘
  ⑦ 总结与展望
```

**演示方式：** 浏览器打开 `design-demos/index.html`，支持：

- **3D 概览墙**：打开即可看到所有页面缩略图
- **全屏演示**：点击「▶ 开始演示」或任意页面，← → 键翻页
- **快捷键**：ESC 回概览，P 打印/导出 PDF

## 许可证

MIT License
