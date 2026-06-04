# BloodPoints - 区块链献血积分系统

基于以太坊区块链的献血积分管理平台，让每一次献血都被永久记录，让爱心传递更有价值。

## 项目简介

BloodPoints 是一个去中心化的献血积分管理系统，利用区块链技术确保献血记录的透明性、不可篡改性和可追溯性。用户通过献血获得积分奖励，可用于兑换商品或转赠给他人。系统支持完整的血液流转追踪，从献血到检测、分配给病人的全过程均可在链上查询。

## 核心功能

| 功能 | 描述 | 状态 |
|------|------|------|
| 献血积分 | 每次献血获得 100 积分奖励 | 已完成 |
| 积分转赠 | 将积分转赠给其他用户 | 已完成 |
| 公益排行榜 | 查看献血积分排名 | 已完成 |
| 血液追踪 | 追踪血液从献血到分配的完整流转记录 | 已完成 |
| 一键模拟 | 模拟血液经过多个血站、检测、分配的完整流程 | 已完成 |
| 商品兑换 | 使用积分兑换商品 | 已完成 |

## 技术栈

### 前端
- React 19 + TypeScript
- Vite 构建工具
- wagmi + viem 以太坊交互库
- RainbowKit 钱包连接组件

### 智能合约
- Solidity ^0.8.28
- OpenZeppelin 安全库
- Hardhat 3 开发框架

### 网络
- 测试网: Sepolia
- 合约地址: `0x6324420a9a5b43f467813a09889594151df9f020`

## 快速开始

### 环境要求
- Node.js >= 18
- npm 或 yarn
- MetaMask 浏览器钱包

### 安装依赖

```bash
# 安装根目录依赖
npm install

# 安装前端依赖
cd frontend
npm install
```

### 启动前端

```bash
cd frontend
npm run dev
```

访问 http://localhost:5173 即可使用。

### 运行测试

```bash
npx hardhat test
```

## 项目结构

```
├── contracts/           # Solidity 智能合约
│   └── BloodPoints.sol  # 核心合约（积分 + 血液追踪）
├── frontend/            # React 前端应用
│   ├── src/
│   │   ├── components/  # UI 组件
│   │   │   ├── BloodDonation.tsx   # 献血界面
│   │   │   ├── BloodTracking.tsx   # 血液追踪 + 模拟流转
│   │   │   ├── Leaderboard.tsx     # 排行榜
│   │   │   ├── TransferPoints.tsx  # 积分转赠
│   │   │   ├── ProductRedemption.tsx # 商品兑换
│   │   │   └── WalletConnect.tsx   # 钱包连接 + 导航
│   │   ├── config/      # wagmi 配置
│   │   └── contracts/   # 合约 ABI 和地址
│   └── ...
├── scripts/             # 部署脚本
├── test/                # 测试文件（31 个测试用例）
└── hardhat.config.ts    # Hardhat 配置
```

## 智能合约 API

### 用户功能
- `donateBlood(bloodType, volume)` - 献血获取积分，同时创建血液记录
- `transferPoints(to, amount)` - 转赠积分
- `redeemProduct(productId)` - 兑换商品

### 血液追踪
- `getBloodUnit(bloodId)` - 查询血液详细信息（血型、血量、状态、时间戳）
- `getBloodTransfers(bloodId)` - 查询血液经过的血站列表
- `getDonorBloods(donor)` - 查询某人的所有献血记录
- `getPatientBloods(patient)` - 查询某病人收到的血液记录
- `getBloodJourney(bloodId)` - 获取血液完整流转旅程（血液信息 + 血站列表）

### 血液状态机
```
Donated（已献血）→ Received（血站接收）→ Tested（已检测）→ Assigned（已分配）
                      ↑
                  可多次流转（多血站）
```

### 管理功能（仅合约 Owner）
- `receiveBlood(bloodId, bloodBank)` - 血站接收血液
- `testBlood(bloodId, passed)` - 血液检测
- `assignToPatient(bloodId, patient)` - 将血液分配给病人
- `addNewProduct(name, price, stock)` - 上架新商品

### 查询功能
- `getPoints(user)` - 查询用户积分
- `getLeaderboard()` - 获取排行榜
- `getProduct(productId)` - 查询商品信息
- `getDonorCount()` - 获取献血者总数

## 安全特性

- 使用 OpenZeppelin 的 `Ownable` 进行权限控制
- 使用 `ReentrancyGuard` 防止重入攻击
- 所有关键操作均有参数验证
- 血液状态机严格校验，防止非法状态跳转

## 许可证

MIT License

## 联系方式

如有问题或建议，欢迎提交 Issue 或 Pull Request。
