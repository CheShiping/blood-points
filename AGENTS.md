# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

热血链 (BloodPoints) is a blockchain-based blood-donation public-welfare transparency DApp on Sepolia testnet (course final project; adapted from reference topic 8 "公益捐赠透明追踪平台"). Users connect a wallet (MetaMask via ethers.js), donate blood to earn 100 ERC20 points (BPT) per donation, view a leaderboard, transfer points, redeem products, and track blood donation journeys through a milestone state machine with IPFS evidence hashes. Deployed contracts (Sepolia): BloodPoints `0x915b9e172d2905dc326c83739db040e08916390c`, BloodPointToken `0x2c837224dd03b36910871c7f32f2dca8d2b0e9c0` (deployer/admin `0x60780f39004283358d1d82820966f57104b2827f`).

## Commands

### Smart Contracts (root directory)
```bash
npx hardhat compile                              # Compile contracts
npx hardhat test                                 # Run tests (Node test runner, test/*.ts, 52 tests)
npx hardhat run scripts/deploy.ts                # Deploy locally (token + platform + minter handover + sample products)
npx hardhat run scripts/deploy-sepolia.ts        # Deploy to Sepolia
npx hardhat run scripts/export-abi.ts            # Export both ABIs from artifacts/ to frontend/src/contracts/
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
- **`frontend/`** — React 19 + TypeScript 6 + Vite 8 SPA. Separate `package.json` with its own dependencies. **ethers.js v6** for all chain interaction (no wagmi/viem/RainbowKit).

### Smart Contracts

**`contracts/BloodPointToken.sol`** — ERC20 points token (OZ `ERC20` + `Ownable` + `Pausable`), symbol BPT, 0 decimals. `mint`/`burnFrom` restricted to `minter` (the BloodPoints platform contract); owner can `setMinter`/`pause`/`unpause`.

**`contracts/BloodPoints.sol`** — main platform contract (`AccessControl` + `Pausable` + `ReentrancyGuard`). Roles: `DEFAULT_ADMIN_ROLE`, `COLLECTOR_ROLE`, `BLOOD_BANK_ROLE`, `LAB_ROLE`, `HOSPITAL_ROLE`.

Key state: `pointsToken` (IERC20), `products`, `nextProductId`, `allDonors`, `isDonor`, `bloodUnits`, `_bloodMilestones` (Milestone[] per bloodId), `donorBloodIds`, `patientBloodIds`, `nextBloodId`, `_bloodIdsByType`, `_allBloodIds`.

Core functions: `donateBlood(bloodType, volume)` (mints 100 BPT), `recordBlood(donor, bloodType, volume, evidence)` (COLLECTOR_ROLE), `receiveBlood(id, bank, evidence)` (BLOOD_BANK_ROLE), `testBlood(id, passed, evidence)` (LAB_ROLE), `assignToPatient(id, patient, evidence)` (HOSPITAL_ROLE), `redeemProduct(id)` (CEI + nonReentrant, burns BPT), `getLeaderboard()`, `getPoints(user)`, `getProduct(id)`, `getDonorCount()`.
Blood journey: `getMilestones(id)`, `getBloodJourney(id)`, `getBloodUnit(id)`, `getDonorBloods(donor)`, `getPatientBloods(patient)`, `getBloodsByType`, `getBloodsByStatus`, `getAllBloodIds()`.

`Milestone` struct: `{ BloodStatus stage; address operator; string location; string evidence /*IPFS CID*/; uint256 timestamp }`. `BloodStatus` enum: `Donated, Received, Tested, Assigned`.

Events: `PointsAwarded`, `MilestoneRecorded`, `BloodCreated`, `BloodReceived`, `BloodTested`, `BloodAssigned`, `ProductAdded`, `ProductRedeemed`, `PointsTokenUpdated`.

### Frontend Provider Chain
`main.tsx`: `WagmiProvider` → `QueryClientProvider` → `ConnectKitProvider` → `WalletProvider` → `App`

- **Wallet connection**: ConnectKit (`ConnectKitButton`) on wagmi/viem; config in `src/config/wagmi.ts` (Sepolia + injected connector, RPC from `VITE_SEPOLIA_RPC_URL`).
- **Wallet bridge** (`src/wallet/WalletContext.tsx`): account/chainId/isConnected from wagmi `useAccount`; ethers `Signer` derived from the active connector's EIP-1193 provider; `JsonRpcProvider` read fallback for view calls.
- **Contract layer** (`src/hooks/useContract.ts`): `useContractRead` (view calls via read provider), `useTx` (write state machine: signing/confirming/success/error + Etherscan link) — all contract reads/writes use **ethers.js**.
- **Contract config** (`src/config/contracts.ts`): addresses (placeholders until deployed), ABIs, role hashes (`keccak256("ROLE_NAME")` via `ethers.id`), `TX_GAS_LIMIT = 300000n`.
- **Contract ABIs** (`src/contracts/BloodPoints.json`, `BloodPointToken.json`): exported from Hardhat artifacts via `scripts/export-abi.ts`.

### Frontend Components (`src/components/`, all `.tsx`)
| Component | Contract Interaction |
|---|---|
| `WalletConnect.tsx` | ConnectKit `ConnectKitButton` + network warning (wagmi `useSwitchChain`) + nav |
| `DonorPanel.tsx` | `donateBlood`, `getDonorBloods`/`getBloodJourney` timeline, ERC20 `transfer`, `redeemProduct` |
| `CollectorPanel.tsx` | `recordBlood` with evidence CID input + `hasRole` check |
| `BloodBankPanel.tsx` | `receiveBlood`/`testBlood`/`assignToPatient` (role-separated) + `getBloodsByType` |
| `Leaderboard.tsx` | `getLeaderboard()` → decode `(address[], uint256[])` tuple |
| `PointsRing.tsx` | `getPoints(address)` |
| `TxFeedback.tsx` | Tx status UI (pending/success/error + Etherscan link) |

### Styling
All styles in `src/index.css` (~1200 lines, CSS custom properties, animations). `App.css` is unused Vite template leftover.

## Hardhat 3 Notes
This project uses **Hardhat 3** (`defineConfig` API, not legacy `module.exports`). The `hardhat-toolbox-viem` plugin provides viem-based test helpers. Solidity tests use `forge-std` (none currently). Two config profiles: `default` (no optimizer) and `production` (optimizer, 200 runs).

## Sepolia Deployment Gotchas
- All frontend write calls need explicit `gasLimit: 300000n` — Sepolia rejects default estimated gas limits.
- Behind a proxy? Set `HTTP_PROXY`/`HTTPS_PROXY` env vars before deploying: `$env:HTTPS_PROXY="http://127.0.0.1:7890"`.
- `.env` uses `SEPOLIA_RPC_URL` + `DEPLOYER_PRIVATE_KEY` + `ETHERSCAN_API_KEY` (matches `.env.example`).
- After redeploying, update `frontend/src/config/contracts.ts` with BOTH new addresses (platform + token) AND run `export-abi.ts`.
- Deploy order matters: BloodPointToken (minter = deployer) → BloodPoints → `token.setMinter(platform)` → `addNewProduct` sample products.

## Testing Notes
- Deploy both contracts in tests: `token = deployContract("BloodPointToken", [admin, admin])`, `platform = deployContract("BloodPoints", [admin, token.address])`, then `token.write.setMinter([platform.address])`.
- Grant roles via AccessControl: `platform.write.grantRole([keccak256(toBytes("COLLECTOR_ROLE")), account])`.
- OZ v5 uses custom errors: AccessControl revert is `AccessControlUnauthorizedAccount` (not a string), pause revert is `EnforcedPause`, ownable revert matches `/Ownable/`. Match those in `assert.rejects`.
- Solidity returns lowercase addresses; viem returns EIP-55 checksummed. Use `.toLowerCase()` on both sides when comparing.
- `getProduct()` returns a named tuple decoded as an array by viem — destructure: `const [id, name, price, stock] = product`.

## Known Issues
- **52 contract tests** in `test/BloodPoints.ts` (37) + `test/BloodPointToken.ts` (15) covering points/ERC20, blood tracking, milestone state machine, access control, pause, and products.
- **Deployed to Sepolia (2026-10-13)**: BloodPoints `0x915b9e172d2905dc326c83739db040e08916390c`, BloodPointToken `0x2c837224dd03b36910871c7f32f2dca8d2b0e9c0`. Source verified on Etherscan + Sourcify. Business roles (COLLECTOR/BLOOD_BANK/LAB/HOSPITAL) still need granting via `scripts/assign-roles.ts`.
- **ABI mismatch risk** — after contract redeployment, run `npx hardhat run scripts/export-abi.ts` from root to regenerate both `frontend/src/contracts/*.json`.
- **On-chain bubble sort** in `getLeaderboard()` — gas-inefficient for large donor lists.
- **No frontend test framework** configured.

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
