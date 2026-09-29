import { useAccount, useReadContract } from 'wagmi';
import { CONTRACT_ABI, CONTRACT_ADDRESS } from '../contracts/config';
import { Trophy } from './icons';

const RING_TARGET = 1000; // 圆环里程碑目标积分

export default function PointsRing() {
  const { address, isConnected } = useAccount();
  const { data: points } = useReadContract({
    abi: CONTRACT_ABI.abi,
    address: CONTRACT_ADDRESS,
    functionName: 'getPoints',
    args: [address],
    query: { enabled: !!address },
  });

  const value = points ? Number(points) : 0;
  const pct = Math.min(value / RING_TARGET, 1);
  const R = 72;
  const C = 2 * Math.PI * R;
  const offset = C * (1 - pct);
  const toNext = Math.max(RING_TARGET - value, 0);

  return (
    <div className="points-ring-card">
      <div className="card-header">
        <div className="card-icon"><Trophy size={22} /></div>
        <h2 className="card-title">我的积分</h2>
      </div>

      <div className="ring-wrap">
        <svg className="ring-svg" viewBox="0 0 180 180" width="180" height="180" aria-hidden="true">
          <circle className="ring-track" cx="90" cy="90" r={R} />
          <circle
            className="ring-fill"
            cx="90"
            cy="90"
            r={R}
            strokeDasharray={C}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="ring-center">
          <span className="ring-value">{value}</span>
          <span className="ring-label">积分</span>
        </div>
      </div>

      <p className="ring-hint">
        {isConnected
          ? toNext > 0
            ? `再获得 ${toNext} 积分解锁下一里程碑`
            : '已达成里程碑目标 🎉'
          : '连接钱包开始献血，获取积分'}
      </p>
    </div>
  );
}
