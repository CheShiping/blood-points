import { useState } from 'react';
import { useWallet } from '../wallet/WalletContext';
import { useContractRead, useTx, TX_GAS_LIMIT, getBloodPointsContract } from '../hooks/useContract';
import { ROLES } from '../config/contracts';
import { Clipboard, Upload, Alert, Shield } from './icons';
import TxFeedback from './TxFeedback';

const BLOOD_TYPES = ['A', 'B', 'AB', 'O'] as const;
const VOLUMES = [200, 300, 400] as const;

export default function CollectorPanel() {
  const { address, isConnected } = useWallet();
  const { status, hash, error, run } = useTx();

  const [donorAddr, setDonorAddr] = useState('');
  const [bloodType, setBloodType] = useState<string>('A');
  const [volume, setVolume] = useState<number>(300);
  const [evidence, setEvidence] = useState('');

  const busy = status === 'signing' || status === 'confirming';

  // 检查当前钱包是否拥有 COLLECTOR_ROLE
  const { data: hasRole } = useContractRead<boolean>(
    (contract) => contract.hasRole(ROLES.COLLECTOR, address!),
    [address]
  );

  const handleRecord = () => {
    if (!donorAddr) return;
    run(async (signer) => {
      const contract = getBloodPointsContract(signer);
      return contract.recordBlood(
        donorAddr,
        bloodType,
        BigInt(volume),
        evidence,
        { gasLimit: TX_GAS_LIMIT }
      );
    });
  };

  return (
    <div className="collector-panel">
      <div className="card-header">
        <div className="card-icon"><Clipboard size={22} /></div>
        <h2 className="card-title">采集血液记录</h2>
      </div>

      <div className="card-content">
        <p className="section-desc">录入献血者信息，将血液记录与凭证哈希上传到区块链</p>

        {isConnected && hasRole === false && (
          <div className="role-warning" role="alert">
            <Alert size={16} /> 当前钱包没有 COLLECTOR_ROLE 权限，请联系管理员授权（scripts/assign-roles.ts）
          </div>
        )}

        <div className="donation-form">
          <div className="form-row">
            <label className="form-label">献血者地址</label>
            <input
              type="text"
              className="form-input"
              name="donorAddress"
              placeholder="0x…"
              value={donorAddr}
              onChange={(e) => setDonorAddr(e.target.value)}
              disabled={!isConnected || busy}
              autoComplete="off"
              spellCheck={false}
              inputMode="text"
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

          <div className="form-row">
            <label className="form-label">
              <span className="label-icon"><Upload size={16} /></span>
              凭证哈希（IPFS CID，可选）
            </label>
            <input
              type="text"
              className="form-input"
              name="evidence"
              placeholder="例如：QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG"
              value={evidence}
              onChange={(e) => setEvidence(e.target.value)}
              disabled={!isConnected || busy}
              autoComplete="off"
              spellCheck={false}
              inputMode="text"
            />
          </div>
        </div>

        <button
          className="donate-btn"
          onClick={handleRecord}
          disabled={!isConnected || busy || !donorAddr || hasRole === false}
        >
          {busy ? (
            <><span className="btn-spinner"></span>上传中…</>
          ) : (
            <><span className="btn-icon"><Upload size={16} /></span>上传血液记录</>
          )}
        </button>

        {isConnected && hasRole === true && (
          <p className="role-ok"><Shield size={14} /> 已验证 COLLECTOR_ROLE 权限</p>
        )}

        <TxFeedback
          status={status}
          hash={hash}
          error={error}
          successMessage="血液记录上传成功！献血者已获得 100 积分"
        />
      </div>
    </div>
  );
}
