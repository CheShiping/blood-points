import { useState } from 'react';
import { useWallet } from './wallet/WalletContext';
import { IS_CONTRACT_CONFIGURED } from './config/contracts';
import WalletConnect from './components/WalletConnect';
import DonorPanel from './components/DonorPanel';
import CollectorPanel from './components/CollectorPanel';
import BloodBankPanel from './components/BloodBankPanel';
import Leaderboard from './components/Leaderboard';
import PointsRing from './components/PointsRing';
import { Syringe, Clipboard, Hospital, Trophy } from './components/icons';

function App() {
  const { address, isConnected } = useWallet();
  const [activeSection, setActiveSection] = useState('home');

  const shortAddress = (addr: string | null | undefined) => {
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
        return null;
    }
  };

  const renderHome = () => (
    <>
      <section className="home-stats">
        <PointsRing />
        <Leaderboard />
      </section>

      <section className="feature-section">
        <div className="features-grid">
          <button type="button" className="feature-card" onClick={() => setActiveSection('donor')}>
            <div className="feature-icon"><Syringe size={28} /></div>
            <h3>献血人员</h3>
            <p>献血获取积分、查看血液流转、兑换奖品</p>
          </button>
          <button type="button" className="feature-card" onClick={() => setActiveSection('collector')}>
            <div className="feature-icon"><Clipboard size={28} /></div>
            <h3>采集记录员</h3>
            <p>录入献血信息，上传凭证哈希到链上</p>
          </button>
          <button type="button" className="feature-card" onClick={() => setActiveSection('bloodbank')}>
            <div className="feature-icon"><Hospital size={28} /></div>
            <h3>血站 / 实验室 / 医院</h3>
            <p>按角色接收、检测血液，分配给病人</p>
          </button>
          <button type="button" className="feature-card" onClick={() => setActiveSection('donor')}>
            <div className="feature-icon"><Trophy size={28} /></div>
            <h3>排行榜</h3>
            <p>查看积分排行榜（位于献血人员面板）</p>
          </button>
        </div>
      </section>
    </>
  );

  return (
    <div className="app">
      <WalletConnect activeSection={activeSection} onNavigate={setActiveSection} />

      {activeSection === 'home' && (
        <header className="app-header">
          <div className="header-text">
            <h1>无偿献血公益透明追踪平台</h1>
            <p>基于区块链的献血积分（ERC20）与血液旅程里程碑存证</p>
          </div>
          {isConnected && (
            <div className="wallet-status">
              <span className="status-dot"></span>
              <span className="status-text">已连接: {shortAddress(address)}</span>
            </div>
          )}
        </header>
      )}

      {!IS_CONTRACT_CONFIGURED && (
        <div className="error" role="alert" style={{ margin: '12px 24px' }}>
          合约地址尚未配置：请先按 README 部署合约，并在 src/config/contracts.ts 中填写地址
        </div>
      )}

      <a href="#main-content" className="skip-link">跳转到主内容</a>

      <main className="app-main" id="main-content">
        {activeSection === 'home' ? (
          renderHome()
        ) : (
          renderRolePanel()
        )}
      </main>

      <footer className="app-footer">
        <p>无偿献血公益透明追踪平台 &copy; 2026 | 教学模拟项目 · 仅部署 Sepolia 测试网</p>
      </footer>
    </div>
  );
}

export default App;
