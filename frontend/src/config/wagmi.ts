import { createConfig, http } from 'wagmi'
import { sepolia } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'
import { SEPOLIA_RPC_URL } from './contracts'

/**
 * ConnectKit 底层的 wagmi 配置：
 * 仅 Sepolia 测试网 + injected 连接器（MetaMask）。
 * RPC 优先使用环境变量 VITE_SEPOLIA_RPC_URL，未配置时回退默认节点。
 */
export const config = createConfig({
  chains: [sepolia],
  connectors: [
    injected(),
  ],
  transports: {
    [sepolia.id]: http(SEPOLIA_RPC_URL),
  },
})

export default config
