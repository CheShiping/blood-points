import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Drop, Home, Syringe, Clipboard, Hospital } from './icons';

interface WalletConnectProps {
  activeSection: string;
  onNavigate: (section: string) => void;
}

export default function WalletConnect({ activeSection, onNavigate }: WalletConnectProps) {
  const navItems = [
    { key: 'home', label: '首页', icon: <Home size={18} /> },
    { key: 'donor', label: '献血人员', icon: <Syringe size={18} /> },
    { key: 'collector', label: '采集记录员', icon: <Clipboard size={18} /> },
    { key: 'bloodbank', label: '血站工作人员', icon: <Hospital size={18} /> },
  ];

  return (
    <div className="wallet-connect">
      <div className="nav-header">
        <div className="nav-logo">
          <span className="logo-icon"><Drop size={28} /></span>
          <span className="logo-text">BloodPoints</span>
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
        <ConnectButton />
      </div>
    </div>
  );
}
