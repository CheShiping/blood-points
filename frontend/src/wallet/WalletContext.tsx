import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { BrowserProvider, JsonRpcProvider } from "ethers";
import type { Eip1193Provider, Signer } from "ethers";
import { useAccount } from "wagmi";
import { SEPOLIA_CHAIN_ID, SEPOLIA_RPC_URL } from "../config/contracts";

interface WalletContextValue {
  address: string | null;
  chainId: number | null;
  isConnected: boolean;
  isCorrectNetwork: boolean;
  /** ethers.js 签名者：由 ConnectKit/wagmi 连接器派生，供写操作使用 */
  signer: Signer | null;
  /** 只读 provider：未连接钱包也能读取链上数据 */
  readProvider: JsonRpcProvider;
}

const WalletContext = createContext<WalletContextValue | null>(null);

/**
 * 钱包上下文（ConnectKit + ethers.js 桥接层）：
 * - 账户 / 链 ID / 连接状态来自 wagmi（ConnectKit 管理连接 UI）
 * - ethers Signer 由 wagmi 连接器的 EIP-1193 provider 派生，合约读写统一走 ethers.js
 */
export function WalletProvider({ children }: { children: ReactNode }) {
  const { address, chainId, isConnected, connector } = useAccount();

  // 只读 provider：未连接钱包也能读取链上数据（惰性初始化，仅创建一次）
  const [readProvider] = useState(() => new JsonRpcProvider(SEPOLIA_RPC_URL));
  const [connectorSigner, setConnectorSigner] = useState<Signer | null>(null);

  // 连接器变化时，派生对应的 ethers 签名者
  useEffect(() => {
    if (!isConnected || !connector) return;
    let cancelled = false;
    // wagmi v2 的 getProvider() 可能返回 Promise，统一包一层
    Promise.resolve(connector.getProvider())
      .then((raw) => {
        const provider = new BrowserProvider(raw as Eip1193Provider);
        return provider.getSigner();
      })
      .then((nextSigner) => {
        if (!cancelled) setConnectorSigner(nextSigner);
      })
      .catch(() => {
        if (!cancelled) setConnectorSigner(null);
      });
    return () => {
      cancelled = true;
    };
  }, [isConnected, connector, address]);

  // 断开连接时对外不暴露签名者（派生值，无需在 effect 中同步清理）
  const signer = isConnected ? connectorSigner : null;

  const value: WalletContextValue = {
    address: address ?? null,
    chainId: chainId ?? null,
    isConnected,
    isCorrectNetwork: chainId === SEPOLIA_CHAIN_ID,
    signer,
    readProvider,
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    throw new Error("useWallet 必须在 WalletProvider 内使用");
  }
  return ctx;
}
