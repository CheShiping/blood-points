import { useState, type ReactNode } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { CONTRACT_ABI, CONTRACT_ADDRESS } from '../contracts/config';
import { Drop, Gem, Heart, User, ShoppingBag, Package, Alert, CheckCircle, Syringe, Hospital, Gift, getProductIcon as productIcon } from './icons';

const STATUS_LABELS: Record<number, { text: string; className: string }> = {
  0: { text: '已献血', className: 'status-donated' },
  1: { text: '血站接收中', className: 'status-received' },
  2: { text: '已检测', className: 'status-tested' },
  3: { text: '已分配', className: 'status-assigned' },
};

interface BloodUnitData {
  bloodId: bigint;
  donor: string;
  volume: bigint;
  bloodType: string;
  testedPassed: boolean;
  patient: string;
  status: number;
  donatedAt: bigint;
  testedAt: bigint;
  assignedAt: bigint;
}

interface BloodTransferData {
  bloodBank: string;
  receivedAt: bigint;
  transferredAt: bigint;
}

// ==================== 血液时间线组件 ====================

function BloodTimeline({ bloodId }: { bloodId: bigint }) {
  const { data: journey } = useReadContract({
    abi: CONTRACT_ABI.abi,
    address: CONTRACT_ADDRESS,
    functionName: 'getBloodJourney',
    args: [bloodId],
  });

  if (!journey) return null;

  const [unit, transfers] = journey as [BloodUnitData, BloodTransferData[]];

  const formatTime = (ts: bigint) => {
    if (ts === 0n) return '—';
    return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(Number(ts) * 1000));
  };

  const shortAddr = (addr: string) => {
    if (!addr || addr === '0x0000000000000000000000000000000000000000') return '未分配';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <div className="blood-timeline">
      <div className="timeline-title">
        <Drop size={16} /> 血液 #{unit.bloodId.toString()} ({unit.bloodType}型, {unit.volume.toString()}ml)
      </div>
      <div className="timeline-nodes">
        <div className="timeline-node active">
          <div className="node-icon"><Syringe size={20} /></div>
          <div className="node-content">
            <div className="node-label">献血者</div>
            <div className="node-value">{shortAddr(unit.donor)}</div>
            <div className="node-time">{formatTime(unit.donatedAt)}</div>
          </div>
        </div>

        {transfers.map((transfer, i) => (
          <div key={i} className={`timeline-node ${i === transfers.length - 1 && unit.status < 3 ? 'current' : 'active'}`}>
            <div className="node-connector">→</div>
            <div className="node-icon"><Hospital size={20} /></div>
            <div className="node-content">
              <div className="node-label">{transfer.bloodBank}</div>
              <div className="node-value">接收: {formatTime(transfer.receivedAt)}</div>
              {transfer.transferredAt > 0n && (
                <div className="node-time">转出: {formatTime(transfer.transferredAt)}</div>
              )}
            </div>
          </div>
        ))}

        {unit.status === 3 && (
          <div className="timeline-node active">
            <div className="node-connector">→</div>
            <div className="node-icon"><Hospital size={20} /></div>
            <div className="node-content">
              <div className="node-label">病人</div>
              <div className="node-value">{shortAddr(unit.patient)}</div>
              <div className="node-time">{formatTime(unit.assignedAt)}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== 血液卡片组件 ====================

function BloodCard({ bloodId }: { bloodId: bigint }) {
  const [expanded, setExpanded] = useState(false);

  const { data: unit } = useReadContract({
    abi: CONTRACT_ABI.abi,
    address: CONTRACT_ADDRESS,
    functionName: 'getBloodUnit',
    args: [bloodId],
  });

  if (!unit) return null;

  const bloodUnit = unit as unknown as BloodUnitData;
  const statusInfo = STATUS_LABELS[bloodUnit.status] || { text: '未知', className: '' };

  return (
    <button type="button" className="blood-card" onClick={() => setExpanded(!expanded)}>
      <div className="blood-card-header">
        <div className="blood-card-info">
          <span className="blood-id">#{bloodUnit.bloodId.toString()}</span>
          <span className="blood-type">{bloodUnit.bloodType}型</span>
          <span className="blood-volume">{bloodUnit.volume.toString()}ml</span>
        </div>
        <span className={`status-badge ${statusInfo.className}`}>
          {statusInfo.text}
        </span>
      </div>
      {expanded && <BloodTimeline bloodId={bloodId} />}
    </button>
  );
}

// ==================== 积分转赠组件 ====================

function TransferSection() {
  const { isConnected } = useAccount();
  const [toAddress, setToAddress] = useState('');
  const [amount, setAmount] = useState('');
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const transferReceipt = useWaitForTransactionReceipt({ hash });

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

  if (transferReceipt.isSuccess && toAddress) {
    setToAddress('');
    setAmount('');
  }

  return (
    <div className="transfer-card">
      <div className="card-header">
        <div className="card-icon"><Heart size={22} /></div>
        <h2 className="card-title">爱心转赠</h2>
      </div>

      <form onSubmit={handleTransfer} className="transfer-form">
        <div className="form-group">
          <label>
            <span className="label-icon"><User size={16} /></span>
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
            <span className="label-icon"><Gem size={16} /></span>
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
            <><span className="btn-spinner"></span>转赠中…</>
          ) : (
            <><span className="btn-icon"><Heart size={16} /></span>转赠积分</>
          )}
        </button>

        {error && (
          <div className="error" role="alert">
            <span className="error-icon"><Alert size={16} /></span>
            错误: {error.message}
          </div>
        )}

        {transferReceipt.isSuccess && (
          <div className="tx-success" aria-live="polite">
            <span className="tx-icon"><CheckCircle size={16} /></span>
            转赠成功！
          </div>
        )}
      </form>
    </div>
  );
}

// ==================== 商品兑换组件 ====================

function ProductCard({ productId, isConnected, isPending, userPoints, onRedeem, getProductIcon }: {
  productId: number;
  isConnected: boolean;
  isPending: boolean;
  userPoints: bigint | undefined;
  onRedeem: (id: bigint) => void;
  getProductIcon: (index: number) => ReactNode;
}) {
  const { data: product } = useReadContract({
    abi: CONTRACT_ABI.abi,
    address: CONTRACT_ADDRESS,
    functionName: 'getProduct',
    args: [BigInt(productId)],
  });

  if (!product || (product as readonly [bigint, string, bigint, bigint])[2] === 0n) return null;

  const productData = product as readonly [bigint, string, bigint, bigint];
  const id = productData[0];
  const name = productData[1];
  const price = productData[2];
  const stock = productData[3];

  return (
    <div className="product-card">
      <div className="product-card-header">
        <div className="product-icon">{getProductIcon(productId)}</div>
        <div className="product-name">{name}</div>
      </div>
      <div className="product-details">
        <div className="product-price">
          <span className="price-label">积分</span>
          <span className="price-value">{price.toString()}</span>
        </div>
        <div className="product-stock">
          <span className="stock-label">库存</span>
          <span className={`stock-value ${stock === 0n ? 'out-of-stock' : ''}`}>
            {stock.toString()}
          </span>
        </div>
      </div>
      <button
        className="redeem-btn"
        onClick={() => onRedeem(id)}
        disabled={!isConnected || isPending || stock === 0n || (!!userPoints && userPoints < price)}
      >
        {isPending ? (
          <><span className="btn-spinner"></span>兑换中…</>
        ) : stock === 0n ? (
          '缺货'
        ) : userPoints && userPoints < price ? (
          '积分不足'
        ) : (
          <><Gift size={16} /> 兑换</>
        )}
      </button>
    </div>
  );
}

function ProductSection() {
  const { address, isConnected } = useAccount();

  const { data: nextProductId, refetch: refetchProducts } = useReadContract({
    abi: CONTRACT_ABI.abi,
    address: CONTRACT_ADDRESS,
    functionName: 'nextProductId',
  });

  const { data: userPoints, refetch: refetchPoints } = useReadContract({
    abi: CONTRACT_ABI.abi,
    address: CONTRACT_ADDRESS,
    functionName: 'getPoints',
    args: [address],
    query: { enabled: !!address },
  });

  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const redeemReceipt = useWaitForTransactionReceipt({ hash });

  const handleRedeem = async (productId: bigint) => {
    try {
      await writeContract({
        abi: CONTRACT_ABI.abi,
        address: CONTRACT_ADDRESS,
        functionName: 'redeemProduct',
        args: [productId],
      });
    } catch (err) {
      console.error('Redemption failed:', err);
    }
  };

  if (redeemReceipt.isSuccess) {
    refetchProducts();
    refetchPoints();
  }

  const getProductIcon = (index: number) => productIcon(index);

  return (
    <div className="product-redemption-card">
      <div className="card-header">
        <div className="card-icon"><ShoppingBag size={22} /></div>
        <h2 className="card-title">商品兑换</h2>
        {userPoints !== undefined && (
          <div className="wallet-status" style={{ marginLeft: 'auto', marginTop: 0 }}>
            <span className="status-text">当前积分: {(userPoints as bigint).toString()}</span>
          </div>
        )}
      </div>

      {!nextProductId || nextProductId === 0n ? (
        <div className="empty-state">
          <div className="empty-icon"><Package size={40} /></div>
          <div>暂无可兑换商品</div>
        </div>
      ) : (
        <div className="product-grid">
          {Array.from({ length: Number(nextProductId) }, (_, i) => (
            <ProductCard
              key={i}
              productId={i}
              isConnected={isConnected}
              isPending={isPending}
              userPoints={userPoints as bigint | undefined}
              onRedeem={handleRedeem}
              getProductIcon={getProductIcon}
            />
          ))}
        </div>
      )}

      {error && (
        <div className="error">
          <span className="error-icon"><Alert size={16} /></span>
          错误: {error.message}
        </div>
      )}

      {redeemReceipt.isSuccess && (
        <div className="tx-success">
          <span className="tx-icon"><CheckCircle size={16} /></span>
          兑换成功！
        </div>
      )}
    </div>
  );
}

// ==================== 献血记录列表 ====================

function BloodRecords() {
  const { address } = useAccount();

  const { data: bloodIds, refetch } = useReadContract({
    abi: CONTRACT_ABI.abi,
    address: CONTRACT_ADDRESS,
    functionName: 'getDonorBloods',
    args: [address],
    query: { enabled: !!address },
  });

  const ids = (bloodIds as bigint[] | undefined) ?? [];

  return (
    <div className="blood-tracking-section">
      <div className="section-header">
        <h2 className="section-title"><Drop size={20} className="title-icon" /> 我的献血记录</h2>
        <button className="refresh-btn" onClick={() => refetch()}>刷新</button>
      </div>
      <div className="blood-list">
        {ids.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><Drop size={40} /></div>
            <p>暂无献血记录</p>
            <p className="empty-hint">完成一次献血后，血液流转记录将显示在这里</p>
          </div>
        ) : (
          ids.map((id) => <BloodCard key={id.toString()} bloodId={id} />)
        )}
      </div>
    </div>
  );
}

// ==================== 献血人员主面板 ====================

export default function DonorPanel() {
  return (
    <div className="donor-panel">
      <BloodRecords />

      <TransferSection />

      <ProductSection />
    </div>
  );
}
