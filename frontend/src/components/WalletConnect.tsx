import { ConnectButton } from '@rainbow-me/rainbowkit';

interface WalletConnectProps {
  activeSection: string;
  onNavigate: (section: string) => void;
}

export default function WalletConnect({ activeSection, onNavigate }: WalletConnectProps) {
  return (
    <div className="wallet-connect">
      <div className="nav-header">
        <div className="nav-logo">
          <span className="logo-icon">🩸</span>
          <span className="logo-text">BloodPoints</span>
        </div>
        <nav className="nav-links">
          <button
            className={`nav-link ${activeSection === 'home' ? 'active' : ''}`}
            onClick={() => onNavigate('home')}
          >
            首页
          </button>
          <button
            className={`nav-link ${activeSection === 'tracking' ? 'active' : ''}`}
            onClick={() => onNavigate('tracking')}
          >
            血液追踪
          </button>
        </nav>
      </div>
      <div className="connect-wrapper">
        <ConnectButton />
      </div>
    </div>
  );
}
