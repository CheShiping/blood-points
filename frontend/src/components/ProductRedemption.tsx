
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { CONTRACT_ABI, CONTRACT_ADDRESS } from '../contracts/config';
import type { ReactNode } from 'react';
import { ShoppingBag, Gift, Package, Alert, CheckCircle, getProductIcon as productIcon } from './icons';

// Helper component to fetch a single product by ID
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

  if (!product || (product as readonly [bigint, string, bigint, bigint])[2] === 0n) return null; // price=0 means product doesn't exist

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

export default function ProductRedemption() {
  const { address, isConnected } = useAccount();

  // Read how many products exist
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
    query: {
      enabled: !!address,
    },
  });

  const { writeContract, data: hash, isPending, error } = useWriteContract();

  const redeemReceipt = useWaitForTransactionReceipt({
    hash,
  });

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

  // 兑换成功后刷新数据
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
        <div className="error" role="alert">
          <span className="error-icon"><Alert size={16} /></span>
          错误: {error.message}
        </div>
      )}

      {redeemReceipt.isSuccess && (
        <div className="tx-success" aria-live="polite">
          <span className="tx-icon"><CheckCircle size={16} /></span>
          兑换成功！
        </div>
      )}
    </div>
  );
}
