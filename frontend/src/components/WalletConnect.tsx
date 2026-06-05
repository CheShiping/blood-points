import { ConnectButton } from '@rainbow-me/rainbowkit';

interface WalletConnectProps {
  activeSection: string;
  onNavigate: (section: string) => void;
}

export default function WalletConnect({ activeSection, onNavigate }: WalletConnectProps) {
  const navItems = [
    { key: 'home', label: '首页', icon: '🏠' },
    { key: 'donor', label: '献血人员', icon: '💉' },
    { key: 'collector', label: '采集记录员', icon: '📝' },
    { key: 'bloodbank', label: '血站工作人员', icon: '🏥' },
  ];

  return (
    <div className="wallet-connect">
      <div className="nav-header">
        <div className="nav-logo">
          <span className="logo-icon">🩸</span>
          <span className="logo-text">BloodPoints</span>
        </div>
        <nav className="nav-links">
          {navItems.map((item) => (
            <button
              key={item.key}
              className={`nav-link ${activeSection === item.key ? 'active' : ''}`}
              onClick={() => onNavigate(item.key)}
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
