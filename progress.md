# 进度日志（Progress）

## 当前状态（Current State）
- 已完成期末改造：选题适配「参考选题 8 · 公益捐赠透明追踪平台」（无偿献血公益场景）。
- 双合约架构（ERC20 积分代币 + 平台合约）、52 个 Hardhat 测试、ethers.js 前端全部完成并通过验证。
- 待办：Sepolia 部署（网络恢复后）、排行榜 gas 优化、前端测试框架（见 feature_list.json）。

## 已完成
### 合约层
- 新增 `contracts/BloodPointToken.sol`：OpenZeppelin ERC20 + Ownable + Pausable，符号 BPT / 0 位小数；`mint`/`burnFrom` 仅限 minter（平台合约）；`setMinter`/`pause`/`unpause` 仅 owner；`_update` 挂钩 `whenNotPaused`。
- 重写 `contracts/BloodPoints.sol`：
  - AccessControl 五角色：`DEFAULT_ADMIN_ROLE`、`COLLECTOR_ROLE`、`BLOOD_BANK_ROLE`、`LAB_ROLE`、`HOSPITAL_ROLE`（原 Ownable + 自定义 Role 枚举移除）。
  - 里程碑状态机：献血 → 血站接收 → 实验室检测 → 医院分配；每步写入 `Milestone{stage, operator, location, evidence(IPFS CID), timestamp}` 并发出 `MilestoneRecorded` 事件。
  - 积分改为 ERC20：`donateBlood`/`recordBlood` 经平台合约铸造 100 BPT；`redeemProduct` 按 CEI + nonReentrant 调用 `burnFrom` 销毁；积分转账改为代币标准 `transfer`（移除 `transferPoints`）。
  - 应急暂停：`pause/unpause`（DEFAULT_ADMIN_ROLE）阻断献血登记与兑换，血液流转不中断。
  - 排行榜改读 ERC20 余额；保留按血型/状态索引查询。
- 脚本更新：`deploy.ts` / `deploy-sepolia.ts`（部署双合约 → 移交 minter → 上架示例商品 → 验证）、`export-abi.ts`（导出两个 ABI）、`assign-roles.ts`（AccessControl grantRole，含角色哈希计算）。
- `hardhat.config.ts`：Sepolia 账户变量改为 `DEPLOYER_PRIVATE_KEY`（与 `.env.example` 一致），新增 `etherscan.apiKey` 配置。

### 测试层（52 个用例全部通过）
- `test/BloodPointToken.ts`（15 例）：元数据、平台铸造/销毁、非 minter 拒绝（权限/安全）、Pausable 转账阻断、非 owner 拒绝、setMinter 零地址校验。
- `test/BloodPoints.ts`（37 例）：ERC20 积分发放/累加/排行榜/兑换销毁、血液追踪与里程碑（操作人/机构/证据 CID）、事件断言、状态机非法跳转、越权调用（×7）、授权/撤销、暂停行为、商品异常、查询函数。

### 前端层（wagmi/RainbowKit → ethers.js v6）
- 新增 `src/config/contracts.ts`：双合约地址/ABI、角色哈希（keccak256）、Sepolia 链参数、只读 RPC（`VITE_SEPOLIA_RPC_URL` 可选）、统一 gasLimit。
- 新增 `src/wallet/WalletContext.tsx`：ethers `BrowserProvider` 连接 MetaMask、账户/网络变化监听、Sepolia 网络检测与一键切换、未连接时经 `JsonRpcProvider` 只读读链。
- 新增 `src/hooks/useContract.ts`：`useContractRead` 只读 Hook、`useTx` 写操作状态机（signing/confirming/success/error + Etherscan 交易链接）。
- 组件重写：`WalletConnect`（自定义连接按钮 + 网络警告）、`PointsRing`、`Leaderboard`、`DonorPanel`（献血表单 + 血液时间线[里程碑]+ ERC20 转赠 + 兑换）、`CollectorPanel`（凭证 CID 输入 + 角色校验提示）、`BloodBankPanel`（血站/实验室/医院三角色分离 + 证据哈希 + 按血型查询）、`TxFeedback`（交易状态提示）。
- 删除废弃组件 `BloodDonation.tsx`、`TransferPoints.tsx`、`ProductRedemption.tsx` 与 `config/wagmi.ts`、`contracts/config.ts`。
- `package.json`：移除 wagmi/rainbowkit/react-query/viem，新增 ethers ^6.13.5。

### 文档
- `README.md`：选题说明、双合约架构、角色表、业务流程、部署/Etherscan 验证/前端配置指引、测试覆盖、合规声明。
- `BLOCKCHAIN.md`：按新架构重写（ERC20、AccessControl、里程碑、IPFS、安全设计）。
- `feature_list.json`、`progress.md`、`session-handoff.md` 同步更新。

## 进行中
- 无。

## 验证证据（Verification Evidence）
- `npx hardhat compile`：Compiled 2 Solidity files with solc 0.8.28（evm target: cancun）。
- `npx hardhat test`：**52 passing (52 nodejs)**，0 failing。
- `npx hardhat run scripts/deploy.ts`（本地网络）：双合约部署 → minter 移交 → 3 个示例商品上架 → 部署验证全部通过。
- **Sepolia 部署（2026-10-13）**：BloodPoints `0x915b9e172d2905dc326c83739db040e08916390c`，BloodPointToken `0x2c837224dd03b36910871c7f32f2dca8d2b0e9c0`；链上复核：`minter → 平台合约`、`pointsToken → 代币`、`nextProductId = 3`（献血纪念T恤 200/50、爱心礼盒 500/20、免费体检券 1000/10）、`POINTS_PER_DONATION = 100`、`paused = false`。前端 `src/config/contracts.ts` 已回填地址。
- **Etherscan 源码验证（2026-10-13）**：两个合约均验证通过（Etherscan V2 API 返回 ABI 可读 + Sourcify  verified）。
- `frontend/`：`npm run build` 通过（tsc -b 零类型错误 + vite build 成功）；`npm run lint` 通过（0 errors）；`npm run dev` 启动后 http://localhost:5173 返回 200。

## 已知问题 / 阻塞（Blockers）
- **Sepolia 不可达**：当前环境本地代理（127.0.0.1:7890）未启动，RPC 连接失败（HHE703）。按考试规则可先用 Hardhat 本地网络演示，并在项目报告中说明原因；网络恢复后执行 `npx hardhat run scripts/deploy-sepolia.ts --network sepolia` 并完成 Etherscan 验证。
- 排行榜链上冒泡排序 gas 问题保留（教学规模可接受），见 feature_list `leaderboard-gas-opt`。
- 前端 `src/config/contracts.ts` 中合约地址为占位零地址，部署后需填入实际地址（页面会显示配置提醒横幅）。

## 下一步建议（Recommended Next Step）
1. 网络恢复后部署 Sepolia 并 Etherscan 验证，回填 `contracts.ts` 地址。
2. 按考试交付物清单准备：项目报告 PDF、答辩 PPT、演示视频（≤5 分钟）、代码 ZIP（剔除 node_modules 与 .env）。
3. 如需继续打磨：实现 `leaderboard-gas-opt`。

## 最后更新（Last Updated）
- 2026-10-27（两轮修复）：
  1. UX：新增 src/hooks/refreshBus.ts 全局数据变更总线（写操作成功后所有读取自动刷新）；读取失败保留旧数据并自动重试 2 次；默认只读 RPC 回退改 publicnode；献血者面板移除自助献血表单（积分由采集员 recordBlood 登记后自动到账）；兑换积分不足时按钮可点击并提示"还需 X 积分"。
  2. recordBlood 回退排查：根因为 gasLimit 300000 不足（实际约 1.65M，out-of-gas），TX_GAS_LIMIT 调至 3000000n；采集员随后两笔登记均成功（gas 1.65M / 1.98M）。
  3. 其他角色交易防呆：诊断确认血站/实验室/医院钱包链上无交易（MetaMask 模拟阶段即被拒，疑为钱包未切换触发 AccessControl）；useContractRead 增加 enabled 参数，BloodBankPanel 三个操作区加「角色 + 状态机」双重守卫（角色不符/状态不符时禁用按钮并显示当前血液状态），CollectorPanel 同步加角色守卫；useTx 增加错误翻译（AccessControl/EnforcedPause/状态机/余额不足/用户取消 → 中文提示）。构建/lint 通过。
