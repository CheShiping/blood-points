
import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { sepolia } from 'wagmi/chains'
import { http } from 'viem'

export const config = getDefaultConfig({
  appName: 'Blood Points',
  projectId: 'blood-points-sepolia-demo',
  chains: [sepolia],
  transports: {
    [sepolia.id]: http('https://eth-sepolia.g.alchemy.com/v2/4Pr9_aeDWxyZeNu0Ytcfh'),
  },
})

export default config
