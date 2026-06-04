import { useState } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { CONTRACT_ABI, CONTRACT_ADDRESS } from '../contracts/config';

const BLOOD_TYPES = ['A', 'B', 'AB', 'O'] as const;
const VOLUMES = [200, 300, 400] as const;

export default function BloodDonation() {
  const { address, isConnected } = useAccount();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const [bloodType, setBloodType] = useState<string>('A');
  const [volume, setVolume] = useState<number>(300);

  const { data: points, refetch: refetchPoints } = useReadContract({
    abi: CONTRACT_ABI.abi,
    address: CONTRACT_ADDRESS,
    functionName: 'getPoints',
    args: [address],
    query: {
      enabled: !!address,
    },
  });

  const donationReceipt = useWaitForTransactionReceipt({
    hash,
  });

  const handleDonate = async () => {
    try {
      await writeContract({
        abi: CONTRACT_ABI.abi,
        address: CONTRACT_ADDRESS,
        functionName: 'donateBlood',
        args: [bloodType, BigInt(volume)],
      });
    } catch (err) {
      console.error('Donation failed:', err);
    }
  };

  // 交易成功后刷新积分
  if (donationReceipt.isSuccess) {
    refetchPoints();
  }

  return (
    <div className="blood-donation-card">
      <div className="card-header">
        <div className="card-icon">🩸</div>
        <h2 className="card-title">献血获取积分</h2>
      </div>

      <div className="card-content">
        <div className="points-display">
          <div className="points-label">当前积分</div>
          <div className="points-value">
            <span className="points-number">{points ? points.toString() : '0'}</span>
            <span className="points-unit">分</span>
          </div>
        </div>

        <div className="donation-form">
          <div className="form-row">
            <label className="form-label">血型</label>
            <div className="blood-type-selector">
              {BLOOD_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  className={`type-btn ${bloodType === type ? 'active' : ''}`}
                  onClick={() => setBloodType(type)}
                >
                  {type}型
                </button>
              ))}
            </div>
          </div>

          <div className="form-row">
            <label className="form-label">献血量 (ml)</label>
            <div className="volume-selector">
              {VOLUMES.map((v) => (
                <button
                  key={v}
                  type="button"
                  className={`volume-btn ${volume === v ? 'active' : ''}`}
                  onClick={() => setVolume(v)}
                >
                  {v}ml
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          className="donate-btn"
          onClick={handleDonate}
          disabled={!isConnected || isPending}
        >
          {isPending ? (
            <>
              <span className="btn-spinner"></span>
              处理中...
            </>
          ) : (
            <>
              <span className="btn-icon">❤️</span>
              献血获取 100 积分
            </>
          )}
        </button>

        {error && (
          <div className="error">
            <span className="error-icon">⚠️</span>
            错误: {error.message}
          </div>
        )}

        {donationReceipt.isSuccess && (
          <div className="tx-success">
            <span className="tx-icon">✅</span>
            献血成功！已获得 100 积分，血液记录已上链
          </div>
        )}
      </div>
    </div>
  );
}
