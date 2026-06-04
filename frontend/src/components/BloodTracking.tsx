import { useState } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { CONTRACT_ABI, CONTRACT_ADDRESS } from '../contracts/config';

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

interface BloodTransferData {
  bloodBank: string;
  receivedAt: bigint;
  transferredAt: bigint;
}

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
    return new Date(Number(ts) * 1000).toLocaleString('zh-CN');
  };

  const shortAddr = (addr: string) => {
    if (!addr || addr === '0x0000000000000000000000000000000000000000') return '未分配';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <div className="blood-timeline">
      <div className="timeline-title">
        🩸 血液 #{unit.bloodId.toString()} ({unit.bloodType}型, {unit.volume.toString()}ml)
      </div>
      <div className="timeline-nodes">
        {/* Donor node */}
        <div className="timeline-node active">
          <div className="node-icon">💉</div>
          <div className="node-content">
            <div className="node-label">献血者</div>
            <div className="node-value">{shortAddr(unit.donor)}</div>
            <div className="node-time">{formatTime(unit.donatedAt)}</div>
          </div>
        </div>

        {/* Blood bank nodes */}
        {transfers.map((transfer, i) => (
          <div key={i} className={`timeline-node ${i === transfers.length - 1 && unit.status < 3 ? 'current' : 'active'}`}>
            <div className="node-connector">→</div>
            <div className="node-icon">🏥</div>
            <div className="node-content">
              <div className="node-label">{transfer.bloodBank}</div>
              <div className="node-value">接收: {formatTime(transfer.receivedAt)}</div>
              {transfer.transferredAt > 0n && (
                <div className="node-time">转出: {formatTime(transfer.transferredAt)}</div>
              )}
            </div>
          </div>
        ))}

        {/* Patient node (if assigned) */}
        {unit.status === 3 && (
          <div className="timeline-node active">
            <div className="node-connector">→</div>
            <div className="node-icon">🏥</div>
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
    <div className="blood-card" onClick={() => setExpanded(!expanded)}>
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
    </div>
  );
}

function SimulationPanel() {
  const { writeContract, data: hash, isPending } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash });
  const [bloodType, setBloodType] = useState<string>('A');
  const [volume, setVolume] = useState<number>(300);
  const [bloodBanks, setBloodBanks] = useState<string>('血站A,血站B');
  const [patientAddr, setPatientAddr] = useState<string>('');
  const [step, setStep] = useState<number>(0);
  const [currentBloodId, setCurrentBloodId] = useState<bigint | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [bankIndex, setBankIndex] = useState<number>(0);

  const steps = ['创建献血记录', '血站接收', '血液检测', '分配病人'];

  const handleSimulate = async () => {
    setSimulating(true);
    setStep(0);
    setBankIndex(0);

    try {
      await writeContract({
        abi: CONTRACT_ABI.abi,
        address: CONTRACT_ADDRESS,
        functionName: 'donateBlood',
        args: [bloodType, BigInt(volume)],
      });
    } catch (err) {
      console.error('Simulation failed:', err);
      setSimulating(false);
    }
  };

  const advanceStep = async () => {
    if (!receipt.isSuccess || !simulating) return;

    const banks = bloodBanks.split(',').map(b => b.trim()).filter(b => b.length > 0);

    if (step === 0) {
      // After donateBlood, start receiving at first blood bank
      setCurrentBloodId(0n);
      setStep(1);
      setBankIndex(0);
      try {
        await writeContract({
          abi: CONTRACT_ABI.abi,
          address: CONTRACT_ADDRESS,
          functionName: 'receiveBlood',
          args: [0n, banks[0] || '血站A'],
        });
      } catch (err) {
        console.error('Receive failed:', err);
        setSimulating(false);
      }
    } else if (step === 1 && currentBloodId !== null) {
      const nextIdx = bankIndex + 1;
      if (nextIdx < banks.length) {
        // More blood banks to go through
        setBankIndex(nextIdx);
        try {
          await writeContract({
            abi: CONTRACT_ABI.abi,
            address: CONTRACT_ADDRESS,
            functionName: 'receiveBlood',
            args: [currentBloodId, banks[nextIdx]],
          });
        } catch (err) {
          console.error('Receive failed:', err);
          setSimulating(false);
        }
      } else {
        // All blood banks done, move to testing
        setStep(2);
        try {
          await writeContract({
            abi: CONTRACT_ABI.abi,
            address: CONTRACT_ADDRESS,
            functionName: 'testBlood',
            args: [currentBloodId, true],
          });
        } catch (err) {
          console.error('Test failed:', err);
          setSimulating(false);
        }
      }
    } else if (step === 2 && currentBloodId !== null) {
      // After testing, assign to patient
      setStep(3);
      try {
        await writeContract({
          abi: CONTRACT_ABI.abi,
          address: CONTRACT_ADDRESS,
          functionName: 'assignToPatient',
          args: [currentBloodId, patientAddr as `0x${string}`],
        });
      } catch (err) {
        console.error('Assign failed:', err);
        setSimulating(false);
      }
    } else if (step === 3) {
      // Done!
      setSimulating(false);
      setStep(4);
    }
  };

  // Trigger step advancement when receipt changes
  if (receipt.isSuccess && simulating && step < 4) {
    setTimeout(advanceStep, 100);
  }

  return (
    <div className="simulation-panel">
      <h3 className="sim-title">🧪 模拟血液流转</h3>
      <p className="sim-desc">一键模拟从献血到分配给病人的完整流程</p>

      <div className="sim-form">
        <div className="form-row">
          <label className="form-label">血型</label>
          <div className="blood-type-selector">
            {BLOOD_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                className={`type-btn ${bloodType === type ? 'active' : ''}`}
                onClick={() => setBloodType(type)}
                disabled={simulating}
              >
                {type}型
              </button>
            ))}
          </div>
        </div>

        <div className="form-row">
          <label className="form-label">献血量</label>
          <div className="volume-selector">
            {VOLUMES.map((v) => (
              <button
                key={v}
                type="button"
                className={`volume-btn ${volume === v ? 'active' : ''}`}
                onClick={() => setVolume(v)}
                disabled={simulating}
              >
                {v}ml
              </button>
            ))}
          </div>
        </div>

        <div className="form-row">
          <label className="form-label">血站名称（逗号分隔）</label>
          <input
            type="text"
            className="form-input"
            value={bloodBanks}
            onChange={(e) => setBloodBanks(e.target.value)}
            placeholder="血站A,血站B"
            disabled={simulating}
          />
        </div>

        <div className="form-row">
          <label className="form-label">病人地址</label>
          <input
            type="text"
            className="form-input"
            value={patientAddr}
            onChange={(e) => setPatientAddr(e.target.value)}
            placeholder="0x..."
            disabled={simulating}
          />
        </div>
      </div>

      {simulating && (
        <div className="sim-progress">
          {steps.map((s, i) => (
            <div key={i} className={`progress-step ${i < step ? 'done' : i === step ? 'active' : ''}`}>
              <div className="step-number">{i + 1}</div>
              <div className="step-label">{s}</div>
            </div>
          ))}
        </div>
      )}

      {step === 4 && (
        <div className="tx-success">
          <span className="tx-icon">✅</span>
          模拟完成！血液已从献血者经过完整流转分配给病人
        </div>
      )}

      <button
        className="sim-btn"
        onClick={handleSimulate}
        disabled={simulating || !patientAddr || isPending}
      >
        {simulating ? '流转中...' : '模拟完整流转'}
      </button>
    </div>
  );
}

export default function BloodTracking() {
  const { address, isConnected } = useAccount();

  const { data: bloodIds, refetch } = useReadContract({
    abi: CONTRACT_ABI.abi,
    address: CONTRACT_ADDRESS,
    functionName: 'getDonorBloods',
    args: [address],
    query: {
      enabled: !!address,
    },
  });

  const ids = (bloodIds as bigint[] | undefined) ?? [];

  return (
    <div className="blood-tracking-section">
      <div className="section-header">
        <h2 className="section-title">🩸 血液追踪</h2>
        <p className="section-desc">追踪你捐献的每一袋血液的完整流转记录</p>
        <button className="refresh-btn" onClick={() => refetch()}>刷新</button>
      </div>

      {isConnected && (
        <>
          <div className="blood-list">
            {ids.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🩸</div>
                <p>暂无献血记录</p>
                <p className="empty-hint">完成一次献血后，血液流转记录将显示在这里</p>
              </div>
            ) : (
              ids.map((id) => <BloodCard key={id.toString()} bloodId={id} />)
            )}
          </div>

          <SimulationPanel />
        </>
      )}
    </div>
  );
}
