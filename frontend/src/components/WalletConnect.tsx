import { ConnectKitButton } from 'connectkit'
import { useSwitchChain } from 'wagmi'
import { useWallet } from '../wallet/WalletContext'
import { SEPOLIA_CHAIN_ID, SEPOLIA_NETWORK_NAME } from '../config/contracts'
import { Drop, Home, Syringe, Clipboard, Hospital, Alert } from './icons'

interface WalletConnectProps {
  activeSection: string;
  onNavigate: (section: string) => void;
}

export default function WalletConnect({ activeSection, onNavigate }: WalletConnectProps) {
  const { isConnected, isCorrectNetwork } = useWallet();
  const { switchChain } = useSwitchChain();

  const navItems = [
    { key: 'home', label: '首页', icon: <Home size={18} /> },
    { key: 'donor', label: '献血人员', icon: <Syringe size={18} /> },
    { key: 'collector', label: '采集记录员', icon: <Clipboard size={18} /> },
    { key: 'bloodbank', label: '血站/实验室/医院', icon: <Hospital size={18} /> },
  ];

  return (
    <div className="wallet-connect">
      <div className="nav-header">
        <div className="nav-logo">
          <span className="logo-icon"><Drop size={28} /></span>
          <span className="logo-text">热血链</span>
        </div>
        <nav className="nav-links">
          {navItems.map((item) => (
            <button
              key={item.key}
              className={`nav-link ${activeSection === item.key ? 'active' : ''}`}
              onClick={() => onNavigate(item.key)}
              aria-current={activeSection === item.key ? 'page' : undefined}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
      </div>
      <div className="connect-wrapper">
        {isConnected && !isCorrectNetwork && (
          <button
            type="button"
            className="network-warning"
            onClick={() => switchChain({ chainId: SEPOLIA_CHAIN_ID })}
          >
            <Alert size={16} /> 网络不符，点击切换到 {SEPOLIA_NETWORK_NAME}
          </button>
        )}
        <ConnectKitButton />
      </div>
    </div>
  );
}
