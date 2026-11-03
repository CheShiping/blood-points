import { useEffect } from "react";

type Listener = () => void;

const listeners = new Set<Listener>();

/**
 * 广播"链上数据已变更"事件：
 * 任意写操作成功后调用，所有 useContractRead 订阅者自动重新加载，
 * 积分、献血记录、商品库存、排行榜等无需手动点击刷新按钮。
 */
export function emitDataChanged() {
  listeners.forEach((listener) => listener());
}

/** 订阅链上数据变更事件 */
export function useDataChanged(listener: Listener) {
  useEffect(() => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, [listener]);
}
