import { useState } from 'react';
import { useAccount } from 'wagmi';
import WalletConnect from './components/WalletConnect';
import DonorPanel from './components/DonorPanel';
import CollectorPanel from './components/CollectorPanel';
import BloodBankPanel from './components/BloodBankPanel';

function App() {
  const { address, isConnected } = useAccount();
  const [activeSection, setActiveSection] = useState('home');

  const shortAddress = (addr: string | undefined) => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const renderRolePanel = () => {
    switch (activeSection) {
      case 'donor':
        return <DonorPanel />;
      case 'collector':
        return <CollectorPanel />;
      case 'bloodbank':
        return <BloodBankPanel />;
      default:
        return (
          <section className="welcome-section">
            <div className="welcome-content">
              <div className="welcome-icon">🩸</div>
              <h2>欢迎使用献血积分系统</h2>
              <p>连接钱包后，请从顶部导航栏选择您的角色</p>
              <div className="features-grid">
                <div className="feature-card" onClick={() => setActiveSection('donor')} style={{ cursor: 'pointer' }}>
                  <div className="feature-icon">💉</div>
                  <h3>献血人员</h3>
                  <p>献血获取积分、查看血液流转、兑换奖品</p>
                </div>
                <div className="feature-card" onClick={() => setActiveSection('collector')} style={{ cursor: 'pointer' }}>
                  <div className="feature-icon">📝</div>
                  <h3>采集记录员</h3>
                  <p>录入献血信息，上传血液记录到链上</p>
                </div>
                <div className="feature-card" onClick={() => setActiveSection('bloodbank')} style={{ cursor: 'pointer' }}>
                  <div className="feature-icon">🏥</div>
                  <h3>血站工作人员</h3>
                  <p>接收、检测血液，分配给病人</p>
                </div>
                <div className="feature-card">
                  <div className="feature-icon">🏆</div>
                  <h3>排行榜</h3>
                  <p>查看积分排行榜</p>
                </div>
              </div>
            </div>
          </section>
        );
    }
  };

  return (
    <div className="app">
      <WalletConnect activeSection={activeSection} onNavigate={setActiveSection} />

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
          renderRolePanel()
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
                  <div className="feature-icon">🏥</div>
                  <h3>血液追踪</h3>
                  <p>追踪血液从献血到病人的完整流转</p>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>

      <footer className="app-footer">
        <p>献血积分系统 &copy; 2026 | 基于区块链技术</p>
      </footer>
    </div>
  );
}

export default App;
