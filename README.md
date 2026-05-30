# BloodPoints - 区块链献血积分系统

基于以太坊区块链的献血积分管理平台，让每一次献血都被永久记录，让爱心传递更有价值。

## 项目简介

BloodPoints 是一个去中心化的献血积分管理系统，利用区块链技术确保献血记录的透明性、不可篡改性和可追溯性。用户通过献血获得积分奖励，可用于兑换商品或转赠给他人。

## 核心功能

| 功能 | 描述 | 状态 |
|------|------|------|
| 献血积分 | 每次献血获得 100 积分奖励 | 已完成 |
| 积分转赠 | 将积分转赠给其他用户 | 已完成 |
| 公益排行榜 | 查看献血积分排名 | 已完成 |
| 商品兑换 | 使用积分兑换商品 | 待实现 |

## 技术栈

### 前端
- React 19 + TypeScript
- Vite 构建工具
- wagmi + viem 以太坊交互库
- RainbowKit 钱包连接组件

### 智能合约
- Solidity ^0.8.28
- OpenZeppelin 安全库
- Hardhat 开发框架

### 网络
- 测试网: Sepolia
- 合约地址: `0xd47bcc8ca39f6411506cd6daeee000d54af97503`

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
│   └── BloodPoints.sol  # 核心合约
├── frontend/            # React 前端应用
│   ├── src/
│   │   ├── components/  # UI 组件
│   │   ├── config/      # wagmi 配置
│   │   └── contracts/   # 合约 ABI 和地址
│   └── ...
├── scripts/             # 部署脚本
├── test/                # 测试文件
└── hardhat.config.ts    # Hardhat 配置
```

## 智能合约 API

### 用户功能
- `donateBlood()` - 献血获取积分
- `transferPoints(to, amount)` - 转赠积分
- `redeemProduct(productId)` - 兑换商品

### 查询功能
- `getPoints(user)` - 查询用户积分
- `getLeaderboard()` - 获取排行榜
- `getProduct(productId)` - 查询商品信息
- `getDonorCount()` - 获取献血者总数

### 管理功能
- `addNewProduct(name, price, stock)` - 上架新商品（仅管理员）

## 安全特性

- 使用 OpenZeppelin 的 `Ownable` 进行权限控制
- 使用 `ReentrancyGuard` 防止重入攻击
- 所有关键操作均有参数验证

## 未来规划

- [ ] 商品兑换前端界面
- [ ] 积分历史记录查询
- [ ] 多链支持
- [ ] 移动端适配
- [ ] NFT 献血证书

## 许可证

MIT License

## 联系方式

如有问题或建议，欢迎提交 Issue 或 Pull Request。
