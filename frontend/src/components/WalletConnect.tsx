
import { ConnectButton } from '@rainbow-me/rainbowkit';

export default function WalletConnect() {
  return (
    <div className="wallet-connect">
      <div className="nav-header">
        <div className="nav-logo">
          <span className="logo-icon">🩸</span>
          <span className="logo-text">BloodPoints</span>
        </div>
      </div>
      <div className="connect-wrapper">
        <ConnectButton />
      </div>
    </div>
  );
}
