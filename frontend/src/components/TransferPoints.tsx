
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { useState } from 'react';
import { CONTRACT_ABI, CONTRACT_ADDRESS } from '../contracts/config';

export default function TransferPoints() {
  const { isConnected } = useAccount();
  const [toAddress, setToAddress] = useState('');
  const [amount, setAmount] = useState('');
  const { writeContract, data: hash, isPending, error } = useWriteContract();

  const transferReceipt = useWaitForTransactionReceipt({
    hash,
  });

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!toAddress || !amount) return;

    try {
      await writeContract({
        abi: CONTRACT_ABI.abi,
        address: CONTRACT_ADDRESS,
        functionName: 'transferPoints',
        args: [toAddress, BigInt(amount)],
      });
    } catch (err) {
      console.error('Transfer failed:', err);
    }
  };

  // 转赠成功后清空表单
  if (transferReceipt.isSuccess && toAddress) {
    setToAddress('');
    setAmount('');
  }

  return (
    <div className="transfer-card">
      <div className="card-header">
        <div className="card-icon">💝</div>
        <h2 className="card-title">爱心转赠</h2>
      </div>

      <form onSubmit={handleTransfer} className="transfer-form">
        <div className="form-group">
          <label>
            <span className="label-icon">👤</span>
            接收地址
          </label>
          <input
            type="text"
            className="dark-input"
            placeholder="0x..."
            value={toAddress}
            onChange={(e) => setToAddress(e.target.value)}
            disabled={!isConnected}
          />
        </div>

        <div className="form-group">
          <label>
            <span className="label-icon">💎</span>
            转赠积分
          </label>
          <input
            type="number"
            className="dark-input"
            placeholder="输入积分数量"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={!isConnected}
            min="1"
          />
        </div>

        <button
          type="submit"
          className="transfer-btn"
          disabled={!isConnected || isPending || !toAddress || !amount}
        >
          {isPending ? (
            <>
              <span className="btn-spinner"></span>
              转赠中...
            </>
          ) : (
            <>
              <span className="btn-icon">💝</span>
              转赠积分
            </>
          )}
        </button>

        {error && (
          <div className="error">
            <span className="error-icon">⚠️</span>
            错误: {error.message}
          </div>
        )}

        {transferReceipt.isSuccess && (
          <div className="tx-success">
            <span className="tx-icon">✅</span>
            转赠成功！
          </div>
        )}
      </form>
    </div>
  );
}
