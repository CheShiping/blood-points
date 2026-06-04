# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BloodPoints (热血链) is a blockchain-based blood donation points DApp on Sepolia testnet. Users connect a wallet, "donate blood" to earn 100 on-chain points per donation, view a leaderboard, transfer points, and redeem points for products. Deployed contract: `0xd47bcc8ca39f6411506cd6daeee000d54af97503`.

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

Core functions: `donateBlood()` (100 pts), `transferPoints(to, amount)`, `redeemProduct(productId)`, `getLeaderboard()` (bubble sort — gas-inefficient at scale), `getPoints(user)`, `getProduct(id)`, `getDonorCount()`.

Events: `PointsAwarded`, `ProductRedeemed`, `PointsTransferred`.

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

### Styling
All styles in `src/index.css` (~1082 lines, CSS custom properties, animations). `App.css` is unused Vite template leftover.

## Hardhat 3 Notes
This project uses **Hardhat 3** (`defineConfig` API, not legacy `module.exports`). The `hardhat-toolbox-viem` plugin provides viem-based test helpers. Solidity tests use `forge-std`. Two config profiles: `default` (no optimizer) and `production` (optimizer, 200 runs).

## Known Issues
- **No BloodPoints tests** — only the boilerplate `Counter` contract has tests (`test/Counter.ts`, `contracts/Counter.t.sol`).
- **ABI mismatch risk** — after contract redeployment, run `npx hardhat run scripts/export-abi.ts` from root to regenerate `frontend/src/contracts/BloodPoints.json`.
- **Hardcoded Alchemy key** in `frontend/src/config/wagmi.ts` — should use `import.meta.env`.
- **No frontend test framework** configured.
- **On-chain bubble sort** in `getLeaderboard()` — gas-inefficient for large donor lists.
