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
 */
export function useContractRead<T>(
  loader: (contract: Contract) => Promise<T>,
  deps: unknown[]
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

  useEffect(() => {
    let cancelled = false;

    loader(getBloodPointsContract(readProvider))
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setError(null);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readProvider, nonce, ...deps]);

  return { data, loading, error, reload };
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

/**
 * 写操作 Hook：统一处理签名、上链确认、状态提示与错误信息
 * @returns run 执行写操作；status / hash / error 供 UI 展示
 */
export function useTx() {
  const { signer } = useWallet();
  const [status, setStatus] = useState<TxStatus>("idle");
  const [hash, setHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (action: (signer: Signer) => Promise<TransactionResponse>) => {
      if (!signer) {
        setStatus("error");
        setError("请先连接钱包");
        return;
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
      } catch (err) {
        setStatus("error");
        const message =
          err instanceof Error
            ? (err as { shortMessage?: string }).shortMessage ?? err.message
            : String(err);
        setError(message);
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
