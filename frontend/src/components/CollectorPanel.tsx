import { useState } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { CONTRACT_ABI, CONTRACT_ADDRESS } from '../contracts/config';

const BLOOD_TYPES = ['A', 'B', 'AB', 'O'] as const;
const VOLUMES = [200, 300, 400] as const;

export default function CollectorPanel() {
  const { isConnected } = useAccount();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash });

  const [donorAddr, setDonorAddr] = useState('');
  const [bloodType, setBloodType] = useState<string>('A');
  const [volume, setVolume] = useState<number>(300);

  const handleRecord = async () => {
    if (!donorAddr) return;
    try {
      await writeContract({
        abi: CONTRACT_ABI.abi,
        address: CONTRACT_ADDRESS,
        functionName: 'recordBlood',
        args: [donorAddr as `0x${string}`, bloodType, BigInt(volume)],
        gas: 500000n,
      });
    } catch (err) {
      console.error('Record failed:', err);
    }
  };

  // 成功后清空表单
  if (receipt.isSuccess && donorAddr) {
    setDonorAddr('');
  }

  return (
    <div className="collector-panel">
      <div className="card-header">
        <div className="card-icon">📝</div>
        <h2 className="card-title">采集血液记录</h2>
      </div>

      <div className="card-content">
        <p className="section-desc">录入献血者信息，将血液记录上传到区块链</p>

        <div className="donation-form">
          <div className="form-row">
            <label className="form-label">献血者地址</label>
            <input
              type="text"
              className="form-input"
              placeholder="0x..."
              value={donorAddr}
              onChange={(e) => setDonorAddr(e.target.value)}
              disabled={!isConnected || isPending}
            />
          </div>

          <div className="form-row">
            <label className="form-label">血型</label>
            <div className="blood-type-selector">
              {BLOOD_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  className={`type-btn ${bloodType === type ? 'active' : ''}`}
                  onClick={() => setBloodType(type)}
                  disabled={isPending}
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
                  disabled={isPending}
                >
                  {v}ml
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          className="donate-btn"
          onClick={handleRecord}
          disabled={!isConnected || isPending || !donorAddr}
        >
          {isPending ? (
            <><span className="btn-spinner"></span>上传中...</>
          ) : (
            <><span className="btn-icon">📝</span>上传血液记录</>
          )}
        </button>

        {error && (
          <div className="error">
            <span className="error-icon">⚠️</span>
            错误: {error.message}
          </div>
        )}

        {receipt.isSuccess && (
          <div className="tx-success">
            <span className="tx-icon">✅</span>
            血液记录上传成功！献血者已获得 100 积分
          </div>
        )}
      </div>
    </div>
  );
}
