import { useAccount } from 'wagmi';
import WalletConnect from './components/WalletConnect';
import BloodDonation from './components/BloodDonation';
import Leaderboard from './components/Leaderboard';
import TransferPoints from './components/TransferPoints';
import ProductRedemption from './components/ProductRedemption';

function App() {
  const { address, isConnected } = useAccount();

  const shortAddress = (addr) => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <div className="app">
      <WalletConnect />

      <header className="app-header">
        <h1>献血积分系统</h1>
        <p>基于区块链的献血积分管理平台</p>
        {isConnected && (
          <div className="wallet-status">
            <span className="status-dot"></span>
            <span className="status-text">已连接: {shortAddress(address)}</span>
          </div>
        )}
      </header>

      <main className="app-main">
        {isConnected ? (
          <>
            <section className="blood-donation-card">
              <BloodDonation />
            </section>

            <section className="leaderboard-card">
              <Leaderboard />
            </section>

            <section className="transfer-card">
              <TransferPoints />
            </section>

            <section className="product-redemption-card">
              <ProductRedemption />
            </section>
          </>
        ) : (
          <section className="welcome-section">
            <div className="welcome-content">
              <div className="welcome-icon">🩸</div>
              <h2>欢迎使用献血积分系统</h2>
              <p>连接钱包开始使用区块链献血积分管理功能</p>
              <div className="features-grid">
                <div className="feature-card">
                  <div className="feature-icon">💉</div>
                  <h3>献血积分</h3>
                  <p>献血获得积分奖励</p>
                </div>
                <div className="feature-card">
                  <div className="feature-icon">💝</div>
                  <h3>积分转赠</h3>
                  <p>与其他用户分享积分</p>
                </div>
                <div className="feature-card">
                  <div className="feature-icon">🎁</div>
                  <h3>商品兑换</h3>
                  <p>使用积分兑换商品</p>
                </div>
                <div className="feature-card">
                  <div className="feature-icon">🏆</div>
                  <h3>排行榜</h3>
                  <p>查看积分排行榜</p>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>

      <footer className="app-footer">
        <p>献血积分系统 &copy; 2024 | 基于区块链技术</p>
      </footer>
    </div>
  );
}

export default App;
