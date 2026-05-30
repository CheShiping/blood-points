
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { CONTRACT_ABI, CONTRACT_ADDRESS } from '../contracts/config';

export default function BloodDonation() {
  const { address, isConnected } = useAccount();
  const { writeContract, data: hash, isPending, error } = useWriteContract();

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
            献血成功！已获得 100 积分
          </div>
        )}
      </div>
    </div>
  );
}
