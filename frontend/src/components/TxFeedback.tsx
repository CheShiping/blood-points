import { ETHERSCAN_TX_URL } from '../config/contracts';
import { TX_STATUS_TEXT, type TxStatus } from '../hooks/useContract';
import { Alert, CheckCircle, ExternalLink } from './icons';

interface TxFeedbackProps {
  status: TxStatus;
  hash: string | null;
  error: string | null;
  successMessage?: string;
}

/** 交易状态提示：签名中 / 确认中 / 成功（附 Etherscan 链接）/ 失败 */
export default function TxFeedback({ status, hash, error, successMessage = '操作成功！' }: TxFeedbackProps) {
  if (status === 'idle') return null;

  if (status === 'signing' || status === 'confirming') {
    return (
      <div className="tx-pending" aria-live="polite">
        <span className="btn-spinner"></span>
        {TX_STATUS_TEXT[status]}
        {hash && (
          <a className="tx-link" href={`${ETHERSCAN_TX_URL}${hash}`} target="_blank" rel="noreferrer">
            查看交易 <ExternalLink size={12} />
          </a>
        )}
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="tx-success" aria-live="polite">
        <span className="tx-icon"><CheckCircle size={16} /></span>
        {successMessage}
        {hash && (
          <a className="tx-link" href={`${ETHERSCAN_TX_URL}${hash}`} target="_blank" rel="noreferrer">
            查看交易 <ExternalLink size={12} />
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="error" role="alert">
      <span className="error-icon"><Alert size={16} /></span>
      错误: {error ?? '未知错误'}
    </div>
  );
}
