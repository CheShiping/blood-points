# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BloodPoints (热血链/BloodLink) is a blockchain-based blood donation points DApp. Users connect an Ethereum wallet on Sepolia testnet, "donate blood" to earn on-chain points, view a leaderboard, transfer points to others, and redeem points for products. The smart contract (`BloodPoints.sol`) is in the parent directory (`../contracts/`).

## Commands

```bash
# Frontend (run from this directory)
npm run dev        # Start Vite dev server with HMR
npm run build      # Type-check (tsc -b) + Vite production build
npm run lint       # ESLint
npm run preview    # Preview production build locally

# Smart contracts (run from parent directory: ../)
npx hardhat test                    # Run all contract tests
npx hardhat test solidity           # Solidity tests only
npx hardhat run scripts/deploy-sepolia.ts  # Deploy to Sepolia
```

## Architecture

### Tech Stack
- **Frontend:** React 19 + TypeScript + Vite 8
- **Web3:** wagmi 2 + viem 2 + RainbowKit 2 (wallet UI) + TanStack React Query
- **Contract:** Solidity 0.8.28, Hardhat 3, OpenZeppelin (Ownable, ReentrancyGuard)
- **Network:** Sepolia testnet; contract deployed at `0xd47bcc8ca39f6411506cd6daeee000d54af97503`

### Provider Chain
`main.tsx` mounts: `WagmiProvider` → `QueryClientProvider` → `RainbowKitProvider` (dark red theme) → `App`

### Contract ABI & Config
- ABI lives in `src/contracts/BloodPoints.json`
- Contract address + ABI are re-exported from `src/contracts/config.js`
- Wagmi/RainbowKit config is in `src/config/wagmi.js` (Sepolia chain, Alchemy RPC)

### Component Structure
All components are in `src/components/` as `.jsx` files (not `.tsx`):
- `WalletConnect.jsx` — Sticky navbar with RainbowKit `ConnectButton`
- `BloodDonation.jsx` — `useReadContract` for points, `useWriteContract` for `donateBlood()`
- `Leaderboard.jsx` — Reads `getLeaderboard()` on-chain, renders ranked table
- `TransferPoints.jsx` — Form calling `transferPoints(address, amount)`
- `ProductRedemption.jsx` — Reads product catalog, calls `redeemProduct(id)`

### Smart Contract (BloodPoints.sol)
Key functions: `donateBlood()` (100 pts/call), `transferPoints()`, `addNewProduct()` (owner-only), `redeemProduct()`, `getLeaderboard()` (bubble sort on-chain). Uses `ReentrancyGuard` on state-changing functions.

### Styling
All styles are in `src/index.css` (1082 lines, CSS custom properties, animations). `App.css` is unused — it's leftover Vite template CSS.

## Known Issues

- **ABI mismatch:** The `BloodPoints.json` ABI defines `getLeaderboard()` as returning `LeaderboardEntry[]` (tuple array), but the actual contract returns `(address[], uint256[])` as separate arrays. If leaderboard reads fail after contract redeployment, regenerate the ABI via `npx hardhat run scripts/export-abi.ts` from the parent directory.
- **Hardcoded secrets:** The Alchemy API key is embedded in `src/config/wagmi.js` rather than using `import.meta.env`.
- **No frontend tests:** No test framework is configured for the frontend.
- **Mixed TS/JS:** Entry files (`main.tsx`, `App.tsx`) use TypeScript, but all 5 components use `.jsx` with no type annotations.
