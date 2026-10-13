import { useContractRead } from '../hooks/useContract';
import { Trophy, ClipboardList, Refresh } from './icons';

export default function Leaderboard() {
  const { data: leaderboardRaw, loading, reload } = useContractRead<[string[], bigint[]]>(
    (contract) => contract.getLeaderboard(),
    []
  );

  const leaderboard: { user: string; points: bigint }[] = leaderboardRaw
    ? leaderboardRaw[0].map((user, i) => ({ user, points: leaderboardRaw[1][i] }))
    : [];

  const getRankClass = (index: number) => {
    if (index === 0) return 'rank-gold';
    if (index === 1) return 'rank-silver';
    if (index === 2) return 'rank-bronze';
    return '';
  };

  const shortAddress = (addr: string) => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <div className="leaderboard-card">
      <div className="card-header">
        <div className="card-icon"><Trophy size={22} /></div>
        <h2 className="card-title">公益排行榜</h2>
      </div>

      {loading ? (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <div>加载中…</div>
        </div>
      ) : leaderboard.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><ClipboardList size={40} /></div>
          <div>暂无排行榜数据</div>
        </div>
      ) : (
        <div className="leaderboard-table-wrapper">
          <table className="leaderboard-table">
            <thead>
              <tr>
                <th>排名</th>
                <th>地址</th>
                <th>积分</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((item, index) => (
                <tr key={index} className={getRankClass(index)}>
                  <td className="rank-cell">
                    <span className="rank-icon">{index + 1}</span>
                  </td>
                  <td className="address-cell">
                    <span className="avatar">{item.user.slice(2, 4).toUpperCase()}</span>
                    <span className="address-text">{shortAddress(item.user)}</span>
                  </td>
                  <td className="points-cell">
                    <span className="points-value">{item.points.toString()}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <button className="refresh-btn" onClick={reload}>
        <Refresh size={16} /> 刷新榜单
      </button>
    </div>
  );
}
