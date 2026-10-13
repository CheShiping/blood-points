import { useState, type ReactNode } from 'react';
import { useWallet } from '../wallet/WalletContext';
import {
  useContractRead,
  useTx,
  TX_GAS_LIMIT,
  getBloodPointsContract,
  getTokenContract,
} from '../hooks/useContract';
import {
  Drop, Gem, Heart, User, ShoppingBag, Package,
  Syringe, Hospital, Gift, getProductIcon as productIcon,
} from './icons';
import TxFeedback from './TxFeedback';

const BLOOD_TYPES = ['A', 'B', 'AB', 'O'] as const;
const VOLUMES = [200, 300, 400] as const;

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

interface MilestoneData {
  stage: number;
  operator: string;
  location: string;
  evidence: string;
  timestamp: bigint;
}

const formatTime = (ts: bigint) => {
  if (ts === 0n) return '—';
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(Number(ts) * 1000));
};

const shortAddr = (addr: string) => {
  if (!addr || addr === '0x0000000000000000000000000000000000000000') return '未分配';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
};

const shortEvidence = (cid: string) => {
  if (!cid) return '—';
  return cid.length > 18 ? `${cid.slice(0, 10)}…${cid.slice(-6)}` : cid;
};

// ==================== 献血获取积分 ====================

function DonateSection() {
  const { isConnected } = useWallet();
  const { status, hash, error, run } = useTx();
  const [bloodType, setBloodType] = useState<string>('A');
  const [volume, setVolume] = useState<number>(300);

  const busy = status === 'signing' || status === 'confirming';

  const handleDonate = () => {
    run(async (signer) => {
      const contract = getBloodPointsContract(signer);
      return contract.donateBlood(bloodType, BigInt(volume), { gasLimit: TX_GAS_LIMIT });
    });
  };

  return (
    <div className="blood-donation-card">
      <div className="card-header">
        <div className="card-icon"><Drop size={22} /></div>
        <h2 className="card-title">献血获取积分</h2>
      </div>

      <div className="card-content">
        <p className="section-desc">每次献血可获得 100 BPT 积分（ERC20 代币），并创建血液追踪记录</p>

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
                  disabled={busy}
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
                  disabled={busy}
                >
                  {v}ml
                </button>
              ))}
            </div>
          </div>
        </div>

        <button className="donate-btn" onClick={handleDonate} disabled={!isConnected || busy}>
          {busy ? (
            <><span className="btn-spinner"></span>处理中…</>
          ) : (
            <><span className="btn-icon"><Heart size={16} /></span>献血获取 100 积分</>
          )}
        </button>

        <TxFeedback
          status={status}
          hash={hash}
          error={error}
          successMessage="献血成功！已获得 100 积分，血液记录已上链"
        />
      </div>
    </div>
  );
}

// ==================== 血液时间线组件 ====================

function BloodTimeline({ bloodId }: { bloodId: bigint }) {
  const { data: journey, reload } = useContractRead<[BloodUnitData, MilestoneData[]]>(
    (contract) => contract.getBloodJourney(bloodId),
    [bloodId]
  );

  if (!journey) return null;

  const [unit, milestones] = journey;

  return (
    <div className="blood-timeline">
      <div className="timeline-title">
        <Drop size={16} /> 血液 #{unit.bloodId.toString()} ({unit.bloodType}型, {unit.volume.toString()}ml)
        <button className="refresh-btn" onClick={reload}>刷新</button>
      </div>
      <div className="timeline-nodes">
        {milestones.map((m, i) => {
          const isCurrent = i === milestones.length - 1 && unit.status < 3;
          return (
            <div key={i} className={`timeline-node ${isCurrent ? 'current' : 'active'}`}>
              {i > 0 && <div className="node-connector">→</div>}
              <div className="node-icon">
                {m.stage === 0 && <Syringe size={20} />}
                {m.stage === 1 && <Hospital size={20} />}
                {m.stage === 2 && <Syringe size={20} />}
                {m.stage === 3 && <Hospital size={20} />}
              </div>
              <div className="node-content">
                <div className="node-label">{STATUS_LABELS[m.stage]?.text ?? '未知'} · {m.location}</div>
                <div className="node-value">操作人: {shortAddr(m.operator)}</div>
                <div className="node-evidence">凭证: {shortEvidence(m.evidence)}</div>
                <div className="node-time">{formatTime(m.timestamp)}</div>
              </div>
            </div>
          );
        })}

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

  const { data: unit } = useContractRead<BloodUnitData>(
    (contract) => contract.getBloodUnit(bloodId),
    [bloodId]
  );

  if (!unit) return null;

  const statusInfo = STATUS_LABELS[unit.status] || { text: '未知', className: '' };

  return (
    <button type="button" className="blood-card" onClick={() => setExpanded(!expanded)}>
      <div className="blood-card-header">
        <div className="blood-card-info">
          <span className="blood-id">#{unit.bloodId.toString()}</span>
          <span className="blood-type">{unit.bloodType}型</span>
          <span className="blood-volume">{unit.volume.toString()}ml</span>
        </div>
        <span className={`status-badge ${statusInfo.className}`}>
          {statusInfo.text}
        </span>
      </div>
      {expanded && <BloodTimeline bloodId={bloodId} />}
    </button>
  );
}

// ==================== 积分转赠组件（ERC20 transfer） ====================

function TransferSection() {
  const { isConnected } = useWallet();
  const { status, hash, error, run } = useTx();
  const [toAddress, setToAddress] = useState('');
  const [amount, setAmount] = useState('');

  const busy = status === 'signing' || status === 'confirming';

  const handleTransfer = () => {
    if (!toAddress || !amount) return;
    run(async (signer) => {
      const contract = getTokenContract(signer);
      return contract.transfer(toAddress, BigInt(amount), { gasLimit: TX_GAS_LIMIT });
    });
  };

  return (
    <div className="transfer-card">
      <div className="card-header">
        <div className="card-icon"><Heart size={22} /></div>
        <h2 className="card-title">爱心转赠（BPT）</h2>
      </div>

      <form
        className="transfer-form"
        onSubmit={(e) => {
          e.preventDefault();
          handleTransfer();
        }}
      >
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
            disabled={!isConnected || busy}
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
            disabled={!isConnected || busy}
            min="1"
          />
        </div>

        <button
          type="submit"
          className="transfer-btn"
          disabled={!isConnected || busy || !toAddress || !amount}
        >
          {busy ? (
            <><span className="btn-spinner"></span>转赠中…</>
          ) : (
            <><span className="btn-icon"><Heart size={16} /></span>转赠积分</>
          )}
        </button>

        <TxFeedback status={status} hash={hash} error={error} successMessage="转赠成功！" />
      </form>
    </div>
  );
}

// ==================== 商品兑换组件 ====================

function ProductCard({ productId, isConnected, busy, userPoints, onRedeem, getProductIcon: getIcon }: {
  productId: number;
  isConnected: boolean;
  busy: boolean;
  userPoints: bigint | undefined;
  onRedeem: (id: bigint) => void;
  getProductIcon: (index: number) => ReactNode;
}) {
  const { data: product } = useContractRead<[bigint, string, bigint, bigint]>(
    (contract) => contract.getProduct(BigInt(productId)),
    [productId]
  );

  if (!product || product[2] === 0n) return null;

  const id = product[0];
  const name = product[1];
  const price = product[2];
  const stock = product[3];

  return (
    <div className="product-card">
      <div className="product-card-header">
        <div className="product-icon">{getIcon(productId)}</div>
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
        disabled={!isConnected || busy || stock === 0n || (!!userPoints && userPoints < price)}
      >
        {busy ? (
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
  const { address, isConnected } = useWallet();
  const { status, hash, error, run } = useTx();

  const { data: nextProductId, reload: reloadProducts } = useContractRead<bigint>(
    (contract) => contract.nextProductId(),
    []
  );

  const { data: userPoints, reload: reloadPoints } = useContractRead<bigint>(
    (contract) => contract.getPoints(address!),
    [address]
  );

  const handleRedeem = (productId: bigint) => {
    run(async (signer) => {
      const contract = getBloodPointsContract(signer);
      return contract.redeemProduct(productId, { gasLimit: TX_GAS_LIMIT });
    });
  };

  if (status === 'success') {
    reloadProducts();
    reloadPoints();
  }

  const getIcon = (index: number) => productIcon(index);
  const busy = status === 'signing' || status === 'confirming';

  return (
    <div className="product-redemption-card">
      <div className="card-header">
        <div className="card-icon"><ShoppingBag size={22} /></div>
        <h2 className="card-title">商品兑换</h2>
        {userPoints != null && (
          <div className="wallet-status" style={{ marginLeft: 'auto', marginTop: 0 }}>
            <span className="status-text">当前积分: {userPoints.toString()}</span>
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
              busy={busy}
              userPoints={userPoints ?? undefined}
              onRedeem={handleRedeem}
              getProductIcon={getIcon}
            />
          ))}
        </div>
      )}

      <TxFeedback status={status} hash={hash} error={error} successMessage="兑换成功！积分已销毁" />
    </div>
  );
}

// ==================== 献血记录列表 ====================

function BloodRecords() {
  const { address } = useWallet();
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: bloodIds } = useContractRead<bigint[]>(
    (contract) => contract.getDonorBloods(address!),
    [address, refreshKey]
  );

  const ids = bloodIds ?? [];

  return (
    <div className="blood-tracking-section">
      <div className="section-header">
        <h2 className="section-title"><Drop size={20} className="title-icon" /> 我的献血记录</h2>
        <button className="refresh-btn" onClick={() => setRefreshKey((k) => k + 1)}>刷新</button>
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
      <DonateSection />

      <BloodRecords />

      <TransferSection />

      <ProductSection />
    </div>
  );
}
