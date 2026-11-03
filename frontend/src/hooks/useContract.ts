import { useCallback, useEffect, useState } from "react";
import { Contract } from "ethers";
import type { ContractRunner, Signer, TransactionResponse } from "ethers";
import {
  BLOOD_POINTS_ABI,
  BLOOD_POINTS_ADDRESS,
  BLOOD_POINT_TOKEN_ABI,
  BLOOD_POINT_TOKEN_ADDRESS,
  TX_GAS_LIMIT,
} from "../config/contracts";
import { useWallet } from "../wallet/WalletContext";
import { emitDataChanged, useDataChanged } from "./refreshBus";

/** 获取平台合约实例（读或写） */
export function getBloodPointsContract(runner: ContractRunner) {
  return new Contract(BLOOD_POINTS_ADDRESS, BLOOD_POINTS_ABI, runner);
}

/** 获取积分代币合约实例（读或写） */
export function getTokenContract(runner: ContractRunner) {
  return new Contract(BLOOD_POINT_TOKEN_ADDRESS, BLOOD_POINT_TOKEN_ABI, runner);
}

/**
 * 只读数据加载 Hook：通过只读 provider 调用合约 view 函数
 * @param loader 加载函数，接收平台合约实例
 * @param deps 依赖数组（如 address），变化时自动重新加载
 * @param enabled 为 false 时跳过加载（用于条件读取，如未选中血液 ID 时）
 */
export function useContractRead<T>(
  loader: (contract: Contract) => Promise<T>,
  deps: unknown[],
  enabled = true
): {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
} {
  const { readProvider } = useWallet();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => {
    setLoading(true);
    setNonce((n) => n + 1);
  }, []);

  // 任意写操作成功后自动刷新（全局事件总线）
  useDataChanged(reload);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;

    const run = () => {
      loader(getBloodPointsContract(readProvider))
        .then((result) => {
          if (cancelled) return;
          setData(result);
          setError(null);
          setLoading(false);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          // 读取失败时保留旧数据（stale），自动重试 2 次，避免界面闪空
          attempts += 1;
          if (attempts <= 2) {
            retryTimer = setTimeout(run, 3000 * attempts);
            return;
          }
          setError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        });
    };

    run();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readProvider, nonce, enabled, ...deps]);

  return { data, loading: enabled ? loading : false, error, reload };
}

/** 交易状态机 */
export type TxStatus = "idle" | "signing" | "confirming" | "success" | "error";

export const TX_STATUS_TEXT: Record<TxStatus, string> = {
  idle: "",
  signing: "等待钱包签名…",
  confirming: "交易确认中…",
  success: "交易成功",
  error: "交易失败",
};

/** 将合约/钱包错误翻译为用户可读的提示 */
function translateError(message: string): string {
  const m = message;
  if (m.includes("AccessControlUnauthorizedAccount"))
    return "当前钱包没有该操作的角色权限，请切换到对应角色的钱包（授权脚本见 scripts/assign-roles.ts）";
  if (m.includes("EnforcedPause")) return "合约已暂停，暂停期间无法执行该操作，请联系管理员";
  if (m.includes("insufficient funds")) return "钱包 ETH 余额不足，无法支付 gas 费，请从水龙头领取测试币";
  if (m.includes("Blood must be received")) return "该血液尚未被血站接收，无法提交检测";
  if (m.includes("Blood must be tested")) return "该血液尚未完成检测，无法分配给病人";
  if (m.includes("Blood test must pass")) return "该血液检测不合格，不可分配给病人";
  if (m.includes("Blood cannot be received")) return "该血液当前状态不允许接收（只有“已献血”状态可接收）";
  if (m.includes("Blood unit does not exist")) return "血液编号不存在，请检查输入";
  if (m.includes("Insufficient points")) return "积分余额不足";
  if (m.includes("Product out of stock")) return "商品库存不足";
  if (m.includes("Product does not exist")) return "商品不存在";
  if (m.includes("user rejected") || m.includes("User rejected")) return "你已在钱包中取消了交易";
  return message;
}

/**
 * 写操作 Hook：统一处理签名、上链确认、状态提示与错误信息
 * @returns run 执行写操作，返回交易是否成功；status / hash / error 供 UI 展示
 */
export function useTx() {
  const { signer } = useWallet();
  const [status, setStatus] = useState<TxStatus>("idle");
  const [hash, setHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (action: (signer: Signer) => Promise<TransactionResponse>): Promise<boolean> => {
      if (!signer) {
        setStatus("error");
        setError("请先连接钱包");
        return false;
      }
      try {
        setStatus("signing");
        setError(null);
        setHash(null);
        const tx = await action(signer);
        setHash(tx.hash);
        setStatus("confirming");
        await tx.wait();
        setStatus("success");
        // 交易确认后广播，全局自动刷新链上数据
        emitDataChanged();
        return true;
      } catch (err) {
        setStatus("error");
        const raw =
          err instanceof Error
            ? (err as { shortMessage?: string }).shortMessage ?? err.message
            : String(err);
        setError(translateError(raw));
        return false;
      }
    },
    [signer]
  );

  const reset = useCallback(() => {
    setStatus("idle");
    setHash(null);
    setError(null);
  }, []);

  return { status, hash, error, run, reset };
}

/** 平台合约写操作的统一 gas limit 预设 */
export { TX_GAS_LIMIT };
