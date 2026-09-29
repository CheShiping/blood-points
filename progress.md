# 进度日志（Progress）

## 当前状态（Current State）
- 合约核心功能、血液追踪、31 个合约测试、Sepolia 部署、ABI 导出与全部前端组件均已完成。
- 待办：排行榜 gas 优化、Alchemy key 移入 env、前端测试框架（见 feature_list.json）。

## 已完成
- `npx hardhat compile` 与 `npx hardhat test` 通过（31 个测试）。
- `frontend/` 下 `npm run build` 与 `npm run lint` 通过。

## 进行中
- 无（当前无进行中的功能）。

## 下一步（Next）
- 优先处理 `leaderboard-gas-opt`：将 getLeaderboard() 的链上冒泡排序改为链下排序或分页读取。

## 验证证据（Verification Evidence）
- 命令与输出由 `./init.sh` 运行产生；`npx hardhat test` 通过 31 项，`npm run build` 成功。

## 最后更新（Last Updated）
- 2026-09-29

## 当前目标（Current Objective）
- 修复 Known Issues 中列出的三项待办（gas 优化、env 配置、前端测试）。

## 下一步建议（Recommended Next Step）
- 实现 `leaderboard-gas-opt` 并补充对应合约测试。

## 阻塞（Blockers）
- 无重大阻塞；前端测试框架选型待定。

## 文件（Files）
- contracts/BloodPoints.sol
- frontend/src/components/*.tsx
- frontend/src/config/wagmi.ts
- feature_list.json
