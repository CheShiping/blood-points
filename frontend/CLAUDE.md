# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BloodPoints (热血链) is a blockchain-based blood donation points DApp on Sepolia testnet. Users connect a wallet, "donate blood" to earn 100 on-chain points per donation, view a leaderboard, transfer points, redeem products, and track blood donation journeys. The smart contract (`BloodPoints.sol`) is in the parent directory (`../contracts/`).

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
- **Contract:** Solidity 0.8.28, Hardhat 3, OpenZeppelin 5.6.1 (Ownable, ReentrancyGuard)
- **Network:** Sepolia testnet; contract deployed at `0x762a3de172619d3f7879d033966d31081a426aa2`

### Provider Chain
`main.tsx` mounts: `WagmiProvider` → `QueryClientProvider` → `RainbowKitProvider` (dark red theme) → `App`

### Contract ABI & Config
- ABI lives in `src/contracts/BloodPoints.json`
- Contract address + ABI are re-exported from `src/contracts/config.ts`
- Wagmi/RainbowKit config is in `src/config/wagmi.ts` (Sepolia chain, Alchemy RPC)

### Component Structure
All components are in `src/components/` as `.tsx` files:
- `WalletConnect.tsx` — Sticky navbar with RainbowKit `ConnectButton`
- `BloodDonation.tsx` — `useReadContract` for points, `useWriteContract` for `donateBlood()`
- `Leaderboard.tsx` — Reads `getLeaderboard()` on-chain, renders ranked table
- `TransferPoints.tsx` — Form calling `transferPoints(address, amount)`
- `ProductRedemption.tsx` — Reads product catalog, calls `redeemProduct(id)`
- `BloodTracking.tsx` — Blood journey cards, timeline visualization, simulation panel
- `DonorPanel.tsx` — Donor role panel for blood tracking
- `CollectorPanel.tsx` — Collector role panel for blood tracking
- `BloodBankPanel.tsx` — Blood bank role panel for blood tracking

### Smart Contract (BloodPoints.sol)
Key functions: `donateBlood(bloodType, volume)` (100 pts), `transferPoints()`, `addNewProduct()` (owner-only), `redeemProduct()`, `getLeaderboard()` (bubble sort), `receiveBlood()`, `testBlood()`, `assignToPatient()` (all owner-only). Uses `ReentrancyGuard` on state-changing functions.

### Styling
All styles are in `src/index.css` (1082 lines, CSS custom properties, animations). `App.css` is unused — it's leftover Vite template CSS.

## Known Issues

- **ABI mismatch:** The `BloodPoints.json` ABI defines `getLeaderboard()` as returning `LeaderboardEntry[]` (tuple array), but the actual contract returns `(address[], uint256[])` as separate arrays. If leaderboard reads fail after contract redeployment, regenerate the ABI via `npx hardhat run scripts/export-abi.ts` from the parent directory.
- **Hardcoded secrets:** The Alchemy API key is embedded in `src/config/wagmi.ts` rather than using `import.meta.env`.
- **No frontend tests:** No test framework is configured for the frontend.
- ~~Mixed TS/JS~~ — All components are now `.tsx`.
