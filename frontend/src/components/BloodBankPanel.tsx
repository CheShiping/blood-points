import { useState, useCallback } from 'react';
import { useWallet } from '../wallet/WalletContext';
import { useContractRead, useTx, TX_GAS_LIMIT, getBloodPointsContract } from '../hooks/useContract';
import { ROLES } from '../config/contracts';
import {
  Hospital, ClipboardList, Inbox, Microscope, Search, Alert, X, Refresh, Drop, Shield,
} from './icons';
import TxFeedback from './TxFeedback';

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

const shortAddr = (addr: string) => {
  if (!addr || addr === '0x0000000000000000000000000000000000000000') return '—';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
};

/** 查询当前钱包是否拥有指定角色 */
function useHasRole(role: string): boolean | null {
  const { address, isConnected } = useWallet();
  const { data: hasRole } = useContractRead<boolean>(
    (contract) => contract.hasRole(role, address!),
    [address],
    isConnected
  );
  return hasRole ?? null;
}

/** 角色校验提示：连接钱包但缺少指定角色时显示警告 */
function RoleNotice({ role }: { role: string }) {
  const { isConnected } = useWallet();
  const hasRole = useHasRole(role);

  if (!isConnected || hasRole !== false) return null;
  return (
    <div className="role-warning" role="alert">
      <Alert size={16} /> 当前钱包没有该角色权限，请切换到对应角色的钱包（授权脚本见 scripts/assign-roles.ts）
    </div>
  );
}

/** 状态机预检提示：所选血液状态不满足当前操作要求时显示 */
function StateNotice({ blocked, hint }: { blocked: boolean; hint: string }) {
  if (!hint) return null;
  return (
    <div className={blocked ? 'role-warning' : 'section-desc'} role={blocked ? 'alert' : undefined}>
      {blocked && <Alert size={16} />} {hint}
      {blocked && ' —— 请先完成前置流程或选择其他血液'}
    </div>
  );
}

// ==================== 全局血液列表 ====================

function AllBloodList({ onSelectBlood }: { onSelectBlood: (id: string) => void }) {
  const { data: allIds, loading, reload } = useContractRead<bigint[]>(
    (contract) => contract.getAllBloodIds(),
    []
  );

  const ids = allIds ?? [];

  return (
    <div className="bloodbank-section all-blood-list">
      <h3 className="section-subtitle"><ClipboardList size={18} className="title-icon" /> 所有血液记录</h3>
      <p className="section-desc">点击任意血液卡片，自动填入下方操作表单</p>
      <button className="refresh-btn" onClick={reload} disabled={loading}>
        {loading ? '加载中...' : <><Refresh size={16} /> 刷新</>}
      </button>

      {ids.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><Drop size={40} /></div>
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
  const { data: unit } = useContractRead<BloodUnitData>(
    (contract) => contract.getBloodUnit(bloodId),
    [bloodId]
  );

  if (!unit) return null;

  const statusInfo = STATUS_LABELS[Number(unit.status)] || { text: '未知', className: '' };

  return (
    <button type="button" className="blood-card clickable" onClick={() => onSelect(bloodId.toString())}>
      <div className="blood-card-header">
        <div className="blood-card-info">
          <span className="blood-id">#{unit.bloodId.toString()}</span>
          <span className="blood-type">{unit.bloodType}型</span>
          <span className="blood-volume">{unit.volume.toString()}ml</span>
          <span className="blood-donor">献血者: {shortAddr(unit.donor)}</span>
        </div>
        <span className={`status-badge ${statusInfo.className}`}>
          {statusInfo.text}
        </span>
      </div>
      {Number(unit.status) === 2 && !unit.testedPassed && (
        <div className="blood-card-warning"><Alert size={16} /> 检测不合格，不可分配</div>
      )}
    </button>
  );
}

// ==================== 接收血液（BLOOD_BANK_ROLE） ====================

function ReceiveSection({ bloodId, onBloodIdChange, onClear }: {
  bloodId: string;
  onBloodIdChange: (id: string) => void;
  onClear: () => void;
}) {
  const { isConnected } = useWallet();
  const { status, hash, error, run } = useTx();

  const [bankName, setBankName] = useState('');
  const [evidence, setEvidence] = useState('');

  const busy = status === 'signing' || status === 'confirming';

  // 守卫：角色 + 状态机预检（血液必须处于「已献血」状态才能接收）
  const hasRole = useHasRole(ROLES.BLOOD_BANK);
  const unitId = /^\d+$/.test(bloodId) ? BigInt(bloodId) : null;
  const { data: unit } = useContractRead<BloodUnitData>(
    (contract) => contract.getBloodUnit(unitId!),
    [unitId],
    unitId !== null
  );
  const stateBlocked = unitId !== null && unit !== null && Number(unit.status) !== 0;

  const handleReceive = async () => {
    if (!bloodId || !bankName) return;
    const ok = await run(async (signer) => {
      const contract = getBloodPointsContract(signer);
      return contract.receiveBlood(BigInt(bloodId), bankName, evidence, { gasLimit: TX_GAS_LIMIT });
    });
    if (ok) {
      setBankName('');
      setEvidence('');
      onClear();
    }
  };

  return (
    <div className="bloodbank-section">
      <h3 className="section-subtitle"><Inbox size={18} className="title-icon" /> 接收血液（血站）</h3>
      <p className="section-desc">接收来自献血者的血液，记录血站与入库凭证哈希</p>

      <RoleNotice role={ROLES.BLOOD_BANK} />

      <div className="donation-form">
        <div className="form-row">
          <label className="form-label">血液 ID</label>
          <input
            type="number"
            className="form-input"
            name="bloodId"
            placeholder="点击上方列表选择，或手动输入"
            value={bloodId}
            onChange={(e) => onBloodIdChange(e.target.value)}
            disabled={!isConnected || busy}
            min="0"
            autoComplete="off"
            inputMode="numeric"
            spellCheck={false}
          />
        </div>
        <div className="form-row">
          <label className="form-label">血站名称</label>
          <input
            type="text"
            className="form-input"
            name="bankName"
            placeholder="例如：成都市血液中心"
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            disabled={!isConnected || busy}
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <div className="form-row">
          <label className="form-label">入库凭证（IPFS CID，可选）</label>
          <input
            type="text"
            className="form-input"
            name="receiveEvidence"
            placeholder="Qm..."
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)}
            disabled={!isConnected || busy}
            autoComplete="off"
            spellCheck={false}
          />
        </div>
      </div>

      {unit && (
        <StateNotice
          blocked={stateBlocked}
          hint={`血液 #${unit.bloodId.toString()} 当前状态：${STATUS_LABELS[Number(unit.status)]?.text ?? '未知'}`}
        />
      )}

      <button
        className="donate-btn"
        onClick={handleReceive}
        disabled={!isConnected || busy || !bloodId || !bankName || hasRole === false || stateBlocked}
      >
        {busy ? (
          <><span className="btn-spinner"></span>处理中…</>
        ) : (
          <><span className="btn-icon"><Inbox size={16} /></span>接收血液</>
        )}
      </button>

      <TxFeedback status={status} hash={hash} error={error} successMessage="血液接收成功！" />
    </div>
  );
}

// ==================== 检测血液（LAB_ROLE） ====================

function TestSection({ bloodId, onBloodIdChange, onClear }: {
  bloodId: string;
  onBloodIdChange: (id: string) => void;
  onClear: () => void;
}) {
  const { isConnected } = useWallet();
  const { status, hash, error, run } = useTx();

  const [passed, setPassed] = useState(true);
  const [evidence, setEvidence] = useState('');

  const busy = status === 'signing' || status === 'confirming';

  // 守卫：角色 + 状态机预检（血液必须处于「血站接收中」状态才能检测）
  const hasRole = useHasRole(ROLES.LAB);
  const unitId = /^\d+$/.test(bloodId) ? BigInt(bloodId) : null;
  const { data: unit } = useContractRead<BloodUnitData>(
    (contract) => contract.getBloodUnit(unitId!),
    [unitId],
    unitId !== null
  );
  const stateBlocked = unitId !== null && unit !== null && Number(unit.status) !== 1;

  const handleTest = async () => {
    if (!bloodId) return;
    const ok = await run(async (signer) => {
      const contract = getBloodPointsContract(signer);
      return contract.testBlood(BigInt(bloodId), passed, evidence, { gasLimit: TX_GAS_LIMIT });
    });
    if (ok) {
      setEvidence('');
      onClear();
    }
  };

  return (
    <div className="bloodbank-section">
      <h3 className="section-subtitle"><Microscope size={18} className="title-icon" /> 检测血液（实验室）</h3>
      <p className="section-desc">对已接收的血液进行质量检测，上传检测报告凭证哈希</p>

      <RoleNotice role={ROLES.LAB} />

      <div className="donation-form">
        <div className="form-row">
          <label className="form-label">血液 ID</label>
          <input
            type="number"
            className="form-input"
            name="bloodId"
            placeholder="点击上方列表选择，或手动输入"
            value={bloodId}
            onChange={(e) => onBloodIdChange(e.target.value)}
            disabled={!isConnected || busy}
            min="0"
            autoComplete="off"
            inputMode="numeric"
            spellCheck={false}
          />
        </div>
        <div className="form-row">
          <label className="form-label">检测结果</label>
          <div className="blood-type-selector">
            <button
              type="button"
              className={`type-btn ${passed ? 'active' : ''}`}
              onClick={() => setPassed(true)}
              disabled={busy}
            >
              合格
            </button>
            <button
              type="button"
              className={`type-btn ${!passed ? 'active' : ''}`}
              onClick={() => setPassed(false)}
              disabled={busy}
            >
              <X size={16} /> 不合格
            </button>
          </div>
        </div>
        <div className="form-row">
          <label className="form-label">检测报告（IPFS CID，可选）</label>
          <input
            type="text"
            className="form-input"
            name="testEvidence"
            placeholder="Qm..."
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)}
            disabled={!isConnected || busy}
            autoComplete="off"
            spellCheck={false}
          />
        </div>
      </div>

      {unit && (
        <StateNotice
          blocked={stateBlocked}
          hint={`血液 #${unit.bloodId.toString()} 当前状态：${STATUS_LABELS[Number(unit.status)]?.text ?? '未知'}`}
        />
      )}

      <button
        className="donate-btn"
        onClick={handleTest}
        disabled={!isConnected || busy || !bloodId || hasRole === false || stateBlocked}
      >
        {busy ? (
          <><span className="btn-spinner"></span>处理中…</>
        ) : (
          <><span className="btn-icon"><Microscope size={16} /></span>提交检测结果</>
        )}
      </button>

      <TxFeedback status={status} hash={hash} error={error} successMessage="检测结果已提交！" />
    </div>
  );
}

// ==================== 分配血液（HOSPITAL_ROLE） ====================

function AssignSection({ bloodId, onBloodIdChange, onClear }: {
  bloodId: string;
  onBloodIdChange: (id: string) => void;
  onClear: () => void;
}) {
  const { isConnected } = useWallet();
  const { status, hash, error, run } = useTx();

  const [patientAddr, setPatientAddr] = useState('');
  const [evidence, setEvidence] = useState('');

  const busy = status === 'signing' || status === 'confirming';

  // 守卫：角色 + 状态机预检（血液必须「已检测且合格」才能分配）
  const hasRole = useHasRole(ROLES.HOSPITAL);
  const unitId = /^\d+$/.test(bloodId) ? BigInt(bloodId) : null;
  const { data: unit } = useContractRead<BloodUnitData>(
    (contract) => contract.getBloodUnit(unitId!),
    [unitId],
    unitId !== null
  );
  const stateBlocked =
    unitId !== null && unit !== null && (Number(unit.status) !== 2 || !unit.testedPassed);
  const assignHint = unit
    ? Number(unit.status) === 2 && !unit.testedPassed
      ? `血液 #${unit.bloodId.toString()} 检测不合格，不可分配`
      : `血液 #${unit.bloodId.toString()} 当前状态：${STATUS_LABELS[Number(unit.status)]?.text ?? '未知'}`
    : '';

  const handleAssign = async () => {
    if (!bloodId || !patientAddr) return;
    const ok = await run(async (signer) => {
      const contract = getBloodPointsContract(signer);
      return contract.assignToPatient(BigInt(bloodId), patientAddr, evidence, { gasLimit: TX_GAS_LIMIT });
    });
    if (ok) {
      setPatientAddr('');
      setEvidence('');
      onClear();
    }
  };

  return (
    <div className="bloodbank-section">
      <h3 className="section-subtitle"><Hospital size={18} className="title-icon" /> 分配血液（医院）</h3>
      <p className="section-desc">将检测合格的血液分配给病人，上传用血凭证哈希</p>

      <RoleNotice role={ROLES.HOSPITAL} />

      <div className="donation-form">
        <div className="form-row">
          <label className="form-label">血液 ID</label>
          <input
            type="number"
            className="form-input"
            name="bloodId"
            placeholder="点击上方列表选择，或手动输入"
            value={bloodId}
            onChange={(e) => onBloodIdChange(e.target.value)}
            disabled={!isConnected || busy}
            min="0"
            autoComplete="off"
            inputMode="numeric"
            spellCheck={false}
          />
        </div>
        <div className="form-row">
          <label className="form-label">病人地址</label>
          <input
            type="text"
            className="form-input"
            name="patientAddress"
            placeholder="0x…"
            value={patientAddr}
            onChange={(e) => setPatientAddr(e.target.value)}
            disabled={!isConnected || busy}
            autoComplete="off"
            spellCheck={false}
            inputMode="text"
          />
        </div>
        <div className="form-row">
          <label className="form-label">用血凭证（IPFS CID，可选）</label>
          <input
            type="text"
            className="form-input"
            name="assignEvidence"
            placeholder="Qm..."
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)}
            disabled={!isConnected || busy}
            autoComplete="off"
            spellCheck={false}
          />
        </div>
      </div>

      {unit && <StateNotice blocked={stateBlocked} hint={assignHint} />}

      <button
        className="donate-btn"
        onClick={handleAssign}
        disabled={!isConnected || busy || !bloodId || !patientAddr || hasRole === false || stateBlocked}
      >
        {busy ? (
          <><span className="btn-spinner"></span>处理中…</>
        ) : (
          <><span className="btn-icon"><Hospital size={16} /></span>分配给病人</>
        )}
      </button>

      <TxFeedback status={status} hash={hash} error={error} successMessage="血液分配成功！" />
    </div>
  );
}

// ==================== 按血型查询 ====================

function BloodQuerySection() {
  const [queryType, setQueryType] = useState<string>('A');
  const [searchTriggered, setSearchTriggered] = useState(false);

  const { data: bloodIds, loading, reload } = useContractRead<bigint[]>(
    (contract) => contract.getBloodsByType(queryType),
    [queryType, searchTriggered]
  );

  const ids = bloodIds ?? [];

  const handleSearch = () => {
    setSearchTriggered(true);
    reload();
  };

  return (
    <div className="bloodbank-section">
      <h3 className="section-subtitle"><Search size={18} className="title-icon" /> 按血型查询</h3>

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

      <button className="donate-btn" onClick={handleSearch} disabled={loading}>
        {loading ? (
          <><span className="btn-spinner"></span>查询中…</>
        ) : (
          <><span className="btn-icon"><Search size={16} /></span>查询 {queryType} 型血液</>
        )}
      </button>

      {searchTriggered && !loading && (
        <div className="blood-query-results">
          {ids.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon"><ClipboardList size={40} /></div>
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
  const { data: unit } = useContractRead<BloodUnitData>(
    (contract) => contract.getBloodUnit(bloodId),
    [bloodId]
  );

  if (!unit) return null;

  const statusInfo = STATUS_LABELS[Number(unit.status)] || { text: '未知', className: '' };

  return (
    <div className="blood-card">
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
    </div>
  );
}

// ==================== 血站工作台主面板 ====================

export default function BloodBankPanel() {
  // 三个操作区共享同一份选中的血液 ID
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
        <div className="card-icon"><Hospital size={22} /></div>
        <h2 className="card-title">血站 / 实验室 / 医院工作台</h2>
        <div className="wallet-status" style={{ marginLeft: 'auto', marginTop: 0 }}>
          <span className="status-text"><Shield size={14} /> 按角色分工操作</span>
        </div>
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
          <ReceiveSection bloodId={selectedBloodId} onBloodIdChange={setSelectedBloodId} onClear={clearSelected} />
        </section>

        <section className="bloodbank-card">
          <TestSection bloodId={selectedBloodId} onBloodIdChange={setSelectedBloodId} onClear={clearSelected} />
        </section>

        <section className="bloodbank-card">
          <AssignSection bloodId={selectedBloodId} onBloodIdChange={setSelectedBloodId} onClear={clearSelected} />
        </section>

        <section className="bloodbank-card">
          <BloodQuerySection />
        </section>
      </div>
    </div>
  );
}
