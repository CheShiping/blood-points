# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BloodPoints (热血链) is a blockchain-based blood donation points DApp on Sepolia testnet. Users connect a wallet, "donate blood" to earn 100 on-chain points per donation, view a leaderboard, transfer points, redeem products, and track blood donation journeys. Deployed contract: `0x762a3de172619d3f7879d033966d31081a426aa2`.

## Commands

### Smart Contracts (root directory)
```bash
npx hardhat compile                              # Compile contracts
npx hardhat test                                 # Run tests (Node test runner, test/*.ts)
npx hardhat test solidity                        # Run Foundry-style Solidity tests (.t.sol)
npx hardhat run scripts/deploy.ts                # Deploy locally
npx hardhat run scripts/deploy-sepolia.ts        # Deploy to Sepolia
npx hardhat run scripts/export-abi.ts            # Export ABI from artifacts/ to frontend/src/contracts/
```

### Frontend (from `frontend/` directory)
```bash
npm run dev       # Vite dev server at http://localhost:5173
npm run build     # tsc -b type-check + Vite production build
npm run lint      # ESLint (TypeScript + React hooks + React Refresh)
npm run preview   # Preview production build
```

## Architecture

### Two-Package Layout
- **Root** — Hardhat 3 project (ESM, `"type": "module"`). Solidity 0.8.28, OpenZeppelin 5.6.1, `@nomicfoundation/hardhat-toolbox-viem`.
- **`frontend/`** — React 19 + TypeScript 6 + Vite 8 SPA. Separate `package.json` with its own dependencies.

### Smart Contract: `contracts/BloodPoints.sol`
Inherits `Ownable` + `ReentrancyGuard` (OpenZeppelin). Owner-only `addNewProduct()` for product management.

Key state: `userPoints` mapping, `products` mapping, `allDonors` array, `isDonor` mapping, `nextProductId` counter.

Core functions: `donateBlood(bloodType, volume)` (100 pts), `transferPoints(to, amount)`, `redeemProduct(productId)`, `getLeaderboard()` (bubble sort — gas-inefficient at scale), `getPoints(user)`, `getProduct(id)`, `getDonorCount()`.
Blood tracking: `receiveBlood(id, bank)`, `testBlood(id, passed)`, `assignToPatient(id, patient)` (all onlyOwner), `getBloodUnit(id)`, `getBloodTransfers(id)`, `getDonorBloods(donor)`, `getPatientBloods(patient)`, `getBloodJourney(id)`.

Events: `PointsAwarded`, `ProductRedeemed`, `PointsTransferred`, `BloodCreated`, `BloodReceived`, `BloodTested`, `BloodAssigned`.

### Frontend Provider Chain
`main.tsx`: `WagmiProvider` → `QueryClientProvider` → `RainbowKitProvider` (red accent) → `App`

- **wagmi config** (`src/config/wagmi.ts`): Sepolia only, injected connector, Alchemy RPC transport.
- **Contract ABI** (`src/contracts/BloodPoints.json`): exported from Hardhat artifacts via `scripts/export-abi.ts`.
- **Contract config** (`src/contracts/config.ts`): re-exports `CONTRACT_ADDRESS` + `CONTRACT_ABI`.

### Frontend Components (`src/components/`, all `.tsx`)
| Component | Contract Interaction |
|---|---|
| `WalletConnect.tsx` | RainbowKit `ConnectButton` in sticky navbar |
| `BloodDonation.tsx` | `useReadContract` for points, `useWriteContract` for `donateBlood()` |
| `Leaderboard.tsx` | `getLeaderboard()` → decode `(address[], uint256[])` tuple |
| `TransferPoints.tsx` | `transferPoints(address, uint256)` |
| `ProductRedemption.tsx` | Iterates `getProduct(0..N)`, calls `redeemProduct(id)` |
| `BloodTracking.tsx` | Blood journey cards, timeline visualization, one-click simulation panel |

### Styling
All styles in `src/index.css` (~1082 lines, CSS custom properties, animations). `App.css` is unused Vite template leftover.

## Hardhat 3 Notes
This project uses **Hardhat 3** (`defineConfig` API, not legacy `module.exports`). The `hardhat-toolbox-viem` plugin provides viem-based test helpers. Solidity tests use `forge-std`. Two config profiles: `default` (no optimizer) and `production` (optimizer, 200 runs).

## Sepolia Deployment Gotchas
- All frontend `writeContract` calls need `gas: 300000n` — Sepolia rejects default estimated gas limits.
- Behind a proxy? Set `HTTP_PROXY`/`HTTPS_PROXY` env vars before deploying: `$env:HTTPS_PROXY="http://127.0.0.1:7890"`.
- After redeploying, update `frontend/src/contracts/config.ts` with the new address AND run `export-abi.ts`.

## Testing Notes
- BloodPoints constructor requires `address initialOwner` (OpenZeppelin v5): `viem.deployContract("BloodPoints", [owner.account.address])`.
- Solidity returns lowercase addresses; viem returns EIP-55 checksummed. Use `.toLowerCase()` on both sides when comparing.
- `getProduct()` returns a named tuple decoded as an array by viem — destructure: `const [name, price, , stock] = product`.

## Known Issues
- **31 contract tests** in `test/BloodPoints.ts` covering points, blood tracking, state machine, access control, and products.
- **ABI mismatch risk** — after contract redeployment, run `npx hardhat run scripts/export-abi.ts` from root to regenerate `frontend/src/contracts/BloodPoints.json`.
- **Hardcoded Alchemy key** in `frontend/src/config/wagmi.ts` — should use `import.meta.env`.
- **No frontend test framework** configured.
- **On-chain bubble sort** in `getLeaderboard()` — gas-inefficient for large donor lists.

## Agent Workflow

### 启动工作流（Startup Workflow）
1. 运行 `./init.sh` 确认合约与前端构建、测试通过。
2. 阅读状态文件 `feature_list.json` 与 `progress.md` 了解当前功能状态。
3. 每次只挑选一个未完成的「单一功能」着手（一次只做一个功能）。

### 验证命令（Verification Commands）
- 合约：`npx hardhat test`、`npx hardhat test solidity`（详见上方 Commands 章节）。
- 前端：`npm run build`、`npm run lint`（在 `frontend/` 目录）。
- 状态文件：`feature_list.json`、`progress.md`。

### 完成定义（Definition of Done）
- 相关单元测试通过（合约和/或前端）。
- 构建与类型检查通过（`npm run build`）。
- 已在 `progress.md` 记录验证证据（命令与输出）。

### 范围边界（Scope）
- 一次只做一个功能（one feature at a time），不要越界修改无关文件。
- 完成门槛由「完成定义」约束范围收尾，未达门槛不算完成。

### 会话结束（End of Session）
- 更新 `progress.md` 与 `session-handoff.md`。
- 记录验证证据、阻塞项与下一步建议，保证下次会话可干净重启。
