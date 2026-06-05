import { useState, useCallback } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { CONTRACT_ABI, CONTRACT_ADDRESS } from '../contracts/config';

const BLOOD_TYPES = ['A', 'B', 'AB', 'O'] as const;

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

// ==================== 全局血液列表 ====================

function AllBloodList({ onSelectBlood }: { onSelectBlood: (id: string) => void }) {
  const { data: allIds, refetch, isLoading } = useReadContract({
    abi: CONTRACT_ABI.abi,
    address: CONTRACT_ADDRESS,
    functionName: 'getAllBloodIds',
  });

  const ids = (allIds as bigint[] | undefined) ?? [];

  return (
    <div className="bloodbank-section all-blood-list">
      <h3 className="section-subtitle">📋 所有血液记录</h3>
      <p className="section-desc">点击任意血液卡片，自动填入下方操作表单</p>
      <button className="refresh-btn" onClick={() => refetch()} disabled={isLoading}>
        {isLoading ? '加载中...' : '🔄 刷新'}
      </button>

      {ids.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🩸</div>
          <p>暂无血液记录，请先让采集记录员上传</p>
        </div>
      ) : (
        <div className="blood-id-list">
          {ids.map((id) => (
            <BloodListItem key={id.toString()} bloodId={id} onSelect={onSelectBlood} />
          ))}
        </div>
      )}
    </div>
  );
}

function BloodListItem({ bloodId, onSelect }: { bloodId: bigint; onSelect: (id: string) => void }) {
  const { data: unit } = useReadContract({
    abi: CONTRACT_ABI.abi,
    address: CONTRACT_ADDRESS,
    functionName: 'getBloodUnit',
    args: [bloodId],
  });

  if (!unit) return null;

  const bloodUnit = unit as unknown as BloodUnitData;
  const statusInfo = STATUS_LABELS[bloodUnit.status] || { text: '未知', className: '' };
  const shortAddr = (addr: string) => {
    if (!addr || addr === '0x0000000000000000000000000000000000000000') return '—';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <div className="blood-card clickable" onClick={() => onSelect(bloodId.toString())}>
      <div className="blood-card-header">
        <div className="blood-card-info">
          <span className="blood-id">#{bloodUnit.bloodId.toString()}</span>
          <span className="blood-type">{bloodUnit.bloodType}型</span>
          <span className="blood-volume">{bloodUnit.volume.toString()}ml</span>
          <span className="blood-donor">献血者: {shortAddr(bloodUnit.donor)}</span>
        </div>
        <span className={`status-badge ${statusInfo.className}`}>
          {statusInfo.text}
        </span>
      </div>
      {bloodUnit.status === 2 && !bloodUnit.testedPassed && (
        <div className="blood-card-warning">⚠️ 检测不合格，不可分配</div>
      )}
    </div>
  );
}

// ==================== 接收血液 ====================

function ReceiveSection({ selectedBloodId, onClear }: { selectedBloodId: string; onClear: () => void }) {
  const { isConnected } = useAccount();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash });

  const [bloodId, setBloodId] = useState(selectedBloodId);
  const [bankName, setBankName] = useState('');

  // 当外部选中变化时同步
  if (selectedBloodId && selectedBloodId !== bloodId && !isPending) {
    setBloodId(selectedBloodId);
  }

  const handleReceive = async () => {
    if (!bloodId || !bankName) return;
    try {
      await writeContract({
        abi: CONTRACT_ABI.abi,
        address: CONTRACT_ADDRESS,
        functionName: 'receiveBlood',
        args: [BigInt(bloodId), bankName],
        gas: 500000n,
      });
    } catch (err) {
      console.error('Receive failed:', err);
    }
  };

  if (receipt.isSuccess && bloodId) {
    setBloodId('');
    setBankName('');
    onClear();
  }

  return (
    <div className="bloodbank-section">
      <h3 className="section-subtitle">📥 接收血液</h3>
      <p className="section-desc">接收来自献血者的血液，记录血站信息</p>

      <div className="donation-form">
        <div className="form-row">
          <label className="form-label">血液 ID</label>
          <input
            type="number"
            className="form-input"
            placeholder="点击上方列表选择，或手动输入"
            value={bloodId}
            onChange={(e) => setBloodId(e.target.value)}
            disabled={!isConnected || isPending}
            min="0"
          />
        </div>
        <div className="form-row">
          <label className="form-label">血站名称</label>
          <input
            type="text"
            className="form-input"
            placeholder="例如：血站A"
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            disabled={!isConnected || isPending}
          />
        </div>
      </div>

      <button
        className="donate-btn"
        onClick={handleReceive}
        disabled={!isConnected || isPending || !bloodId || !bankName}
      >
        {isPending ? (
          <><span className="btn-spinner"></span>处理中...</>
        ) : (
          <><span className="btn-icon">📥</span>接收血液</>
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
          血液接收成功！
        </div>
      )}
    </div>
  );
}

// ==================== 检测血液 ====================

function TestSection({ selectedBloodId, onClear }: { selectedBloodId: string; onClear: () => void }) {
  const { isConnected } = useAccount();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash });

  const [bloodId, setBloodId] = useState(selectedBloodId);
  const [passed, setPassed] = useState(true);

  if (selectedBloodId && selectedBloodId !== bloodId && !isPending) {
    setBloodId(selectedBloodId);
  }

  const handleTest = async () => {
    if (!bloodId) return;
    try {
      await writeContract({
        abi: CONTRACT_ABI.abi,
        address: CONTRACT_ADDRESS,
        functionName: 'testBlood',
        args: [BigInt(bloodId), passed],
        gas: 500000n,
      });
    } catch (err) {
      console.error('Test failed:', err);
    }
  };

  if (receipt.isSuccess && bloodId) {
    setBloodId('');
    onClear();
  }

  return (
    <div className="bloodbank-section">
      <h3 className="section-subtitle">🔬 检测血液</h3>
      <p className="section-desc">对已接收的血液进行质量检测</p>

      <div className="donation-form">
        <div className="form-row">
          <label className="form-label">血液 ID</label>
          <input
            type="number"
            className="form-input"
            placeholder="点击上方列表选择，或手动输入"
            value={bloodId}
            onChange={(e) => setBloodId(e.target.value)}
            disabled={!isConnected || isPending}
            min="0"
          />
        </div>
        <div className="form-row">
          <label className="form-label">检测结果</label>
          <div className="blood-type-selector">
            <button
              type="button"
              className={`type-btn ${passed ? 'active' : ''}`}
              onClick={() => setPassed(true)}
              disabled={isPending}
            >
              ✅ 合格
            </button>
            <button
              type="button"
              className={`type-btn ${!passed ? 'active' : ''}`}
              onClick={() => setPassed(false)}
              disabled={isPending}
            >
              ❌ 不合格
            </button>
          </div>
        </div>
      </div>

      <button
        className="donate-btn"
        onClick={handleTest}
        disabled={!isConnected || isPending || !bloodId}
      >
        {isPending ? (
          <><span className="btn-spinner"></span>处理中...</>
        ) : (
          <><span className="btn-icon">🔬</span>提交检测结果</>
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
          检测结果已提交！
        </div>
      )}
    </div>
  );
}

// ==================== 分配血液 ====================

function AssignSection({ selectedBloodId, onClear }: { selectedBloodId: string; onClear: () => void }) {
  const { isConnected } = useAccount();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash });

  const [bloodId, setBloodId] = useState(selectedBloodId);
  const [patientAddr, setPatientAddr] = useState('');

  if (selectedBloodId && selectedBloodId !== bloodId && !isPending) {
    setBloodId(selectedBloodId);
  }

  const handleAssign = async () => {
    if (!bloodId || !patientAddr) return;
    try {
      await writeContract({
        abi: CONTRACT_ABI.abi,
        address: CONTRACT_ADDRESS,
        functionName: 'assignToPatient',
        args: [BigInt(bloodId), patientAddr as `0x${string}`],
        gas: 500000n,
      });
    } catch (err) {
      console.error('Assign failed:', err);
    }
  };

  if (receipt.isSuccess && bloodId) {
    setBloodId('');
    setPatientAddr('');
    onClear();
  }

  return (
    <div className="bloodbank-section">
      <h3 className="section-subtitle">🏥 分配血液</h3>
      <p className="section-desc">将检测合格的血液分配给病人</p>

      <div className="donation-form">
        <div className="form-row">
          <label className="form-label">血液 ID</label>
          <input
            type="number"
            className="form-input"
            placeholder="点击上方列表选择，或手动输入"
            value={bloodId}
            onChange={(e) => setBloodId(e.target.value)}
            disabled={!isConnected || isPending}
            min="0"
          />
        </div>
        <div className="form-row">
          <label className="form-label">病人地址</label>
          <input
            type="text"
            className="form-input"
            placeholder="0x..."
            value={patientAddr}
            onChange={(e) => setPatientAddr(e.target.value)}
            disabled={!isConnected || isPending}
          />
        </div>
      </div>

      <button
        className="donate-btn"
        onClick={handleAssign}
        disabled={!isConnected || isPending || !bloodId || !patientAddr}
      >
        {isPending ? (
          <><span className="btn-spinner"></span>处理中...</>
        ) : (
          <><span className="btn-icon">🏥</span>分配给病人</>
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
          血液分配成功！
        </div>
      )}
    </div>
  );
}

// ==================== 按血型查询 ====================

function BloodQuerySection() {
  const [queryType, setQueryType] = useState<string>('A');
  const [searchTriggered, setSearchTriggered] = useState(false);

  const { data: bloodIds, isLoading, refetch } = useReadContract({
    abi: CONTRACT_ABI.abi,
    address: CONTRACT_ADDRESS,
    functionName: 'getBloodsByType',
    args: [queryType],
    query: { enabled: searchTriggered },
  });

  const ids = (bloodIds as bigint[] | undefined) ?? [];

  const handleSearch = () => {
    setSearchTriggered(true);
    refetch();
  };

  return (
    <div className="bloodbank-section">
      <h3 className="section-subtitle">🔍 按血型查询</h3>

      <div className="donation-form">
        <div className="form-row">
          <div className="blood-type-selector">
            {BLOOD_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                className={`type-btn ${queryType === type ? 'active' : ''}`}
                onClick={() => { setQueryType(type); setSearchTriggered(false); }}
              >
                {type}型
              </button>
            ))}
          </div>
        </div>
      </div>

      <button className="donate-btn" onClick={handleSearch} disabled={isLoading}>
        {isLoading ? (
          <><span className="btn-spinner"></span>查询中...</>
        ) : (
          <><span className="btn-icon">🔍</span>查询 {queryType} 型血液</>
        )}
      </button>

      {searchTriggered && !isLoading && (
        <div className="blood-query-results">
          {ids.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📋</div>
              <p>暂无 {queryType} 型血液记录</p>
            </div>
          ) : (
            <div className="blood-id-list">
              <p className="result-count">共 {ids.length} 条：</p>
              {ids.map((id) => (
                <BloodQueryCard key={id.toString()} bloodId={id} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BloodQueryCard({ bloodId }: { bloodId: bigint }) {
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
    <div className="blood-card">
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
    </div>
  );
}

// ==================== 血站工作人员主面板 ====================

export default function BloodBankPanel() {
  const [selectedBloodId, setSelectedBloodId] = useState('');

  const handleSelectBlood = useCallback((id: string) => {
    setSelectedBloodId(id);
  }, []);

  const clearSelected = useCallback(() => {
    setSelectedBloodId('');
  }, []);

  return (
    <div className="bloodbank-panel">
      <div className="card-header">
        <div className="card-icon">🏥</div>
        <h2 className="card-title">血站工作台</h2>
      </div>

      {/* 顶部：所有血液列表 */}
      <AllBloodList onSelectBlood={handleSelectBlood} />

      {/* 选中提示 */}
      {selectedBloodId && (
        <div className="selected-blood-hint">
          已选中血液 <strong>#{selectedBloodId}</strong>
          <button className="clear-btn" onClick={clearSelected}>取消选择</button>
        </div>
      )}

      {/* 操作区 */}
      <div className="bloodbank-grid">
        <section className="bloodbank-card">
          <ReceiveSection selectedBloodId={selectedBloodId} onClear={clearSelected} />
        </section>

        <section className="bloodbank-card">
          <TestSection selectedBloodId={selectedBloodId} onClear={clearSelected} />
        </section>

        <section className="bloodbank-card">
          <AssignSection selectedBloodId={selectedBloodId} onClear={clearSelected} />
        </section>

        <section className="bloodbank-card">
          <BloodQuerySection />
        </section>
      </div>
    </div>
  );
}
