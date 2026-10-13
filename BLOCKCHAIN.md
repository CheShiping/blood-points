# 区块链特性应用说明

## 一、为什么选择区块链？

传统献血公益追踪存在以下痛点：

| 问题 | 传统方案 | 区块链方案 |
|------|----------|------------|
| 积分数据可被管理员篡改 | 中心化数据库，管理员可随意修改 | ERC20 代币链上发行，规则由合约强制执行 |
| 血液流转记录可被删除 | 日志可被清除或修改 | 里程碑记录永久上链，不可删除 |
| 多机构协作需要互信 | 依赖中心化第三方背书 | AccessControl 角色权限 + 合约自动执行 |
| 捐赠凭证易伪造 | 纸质/图片凭证可 PS | IPFS 凭证哈希上链公示，可校验 |
| 数据透明度低 | 用户无法验证数据真实性 | 所有交易公开可验证 |

## 二、链上 vs 链下数据划分

### 链上数据（存储在区块链）

| 数据类型 | 存储位置 | 上链理由 |
|----------|----------|----------|
| 用户积分 | ERC20 `BloodPointToken` 余额 | 积分即代币，转账/销毁遵循标准，不可篡改 |
| 血液记录 | `mapping(uint256 => BloodUnit) bloodUnits` | 血液溯源需要永久、可追溯的记录 |
| 血液状态 | `BloodUnit.status` | 状态机转换必须严格校验、不可回退 |
| 里程碑流转 | `mapping(uint256 => Milestone[]) _bloodMilestones` | 每步操作人、机构、凭证哈希需多方验证 |
| 凭证哈希 | `Milestone.evidence`（IPFS CID） | 大文件存 IPFS，哈希上链锚定真实性 |
| 商品信息 | `mapping(uint256 => Product) products` | 商品库存和价格需要透明 |
| 角色权限 | AccessControl 角色表 | 权限控制必须由合约强制执行 |
| 事件日志 | `event MilestoneRecorded/BloodReceived/...` | 链上事件可用于审计和追踪 |

### 链下数据（前端/服务器）

| 数据类型 | 存储位置 | 不上链理由 |
|----------|----------|------------|
| 前端 UI | 用户浏览器 | 界面渲染不需要链上存储 |
| 钱包会话 | MetaMask + ethers.js BrowserProvider | 临时状态，无需上链 |
| ABI 文件 | 前端代码 | 合约接口描述，不涉及业务状态 |
| IPFS 凭证文件 | IPFS 网络（Pinata 等） | 大文件存储成本高，用哈希上链锚定 |

## 三、区块链特性在项目中的体现

### 1. 去中心化

- 合约部署在以太坊测试网，不依赖单一服务器
- 任何节点均可验证交易有效性
- 积分发行/销毁规则写在合约中，任何一方无法超发

**代码体现：**
```solidity
// ERC20 积分代币：只有受信任的平台合约（minter）可以铸造/销毁
function mint(address to, uint256 amount) external onlyMinter {
    _mint(to, amount);
}
```

### 2. 不可篡改

- 一旦交易确认，积分余额、里程碑记录永久写入区块链
- 管理员也无法回滚或修改历史数据

**代码体现：**
```solidity
function donateBlood(string calldata bloodType, uint256 volume)
    external whenNotPaused nonReentrant
{
    // Checks → Effects → Interactions
    _createBlood(msg.sender, bloodType, volume, "", msg.sender);
    _awardPoints(msg.sender, nextBloodId - 1); // 铸造 100 BPT
}
```

### 3. 可追溯

- 每个里程碑包含：阶段、操作人钱包、机构名称、IPFS 凭证 CID、时间戳
- `getBloodJourney(bloodId)` 一站式查询血液从献血到分配的全过程
- 事件日志支持链下审计

**代码体现：**
```solidity
struct Milestone {
    BloodStatus stage;   // 到达的阶段
    address operator;    // 操作人钱包地址
    string location;     // 机构名称
    string evidence;     // IPFS 凭证 CID
    uint256 timestamp;   // 上链时间
}
```

### 4. 多方协作共识

- 采集记录员、血站、实验室、医院各司其职，角色由 AccessControl 强制执行
- 状态机校验确保业务流程不可跳跃
- 紧急情况下管理员可暂停献血登记与兑换，但血液流转不中断（保障临床用血）

**代码体现：**
```solidity
bytes32 public constant COLLECTOR_ROLE = keccak256("COLLECTOR_ROLE");
bytes32 public constant BLOOD_BANK_ROLE = keccak256("BLOOD_BANK_ROLE");
bytes32 public constant LAB_ROLE = keccak256("LAB_ROLE");
bytes32 public constant HOSPITAL_ROLE = keccak256("HOSPITAL_ROLE");

function receiveBlood(uint256 bloodId, string calldata bloodBank, string calldata evidence)
    external onlyRole(BLOOD_BANK_ROLE)
{
    require(unit.status == BloodStatus.Donated, "Blood cannot be received in current status");
    // ...
}
```

## 四、状态机设计

血液状态转换完全由智能合约强制执行：

```
Donated（已献血）
    │  receiveBlood（BLOOD_BANK_ROLE）
    ▼
Received（血站接收）
    │  testBlood（LAB_ROLE）
    ▼
Tested（已检测）
    ├── passed = true ──▶ Assigned（已分配给病人，HOSPITAL_ROLE）
    └── passed = false ──▶ 终止（不可分配）
```

**状态转换规则：**

| 当前状态 | 允许的操作 | 前置条件 |
|----------|------------|----------|
| Donated | receiveBlood | BLOOD_BANK_ROLE |
| Received | testBlood | LAB_ROLE |
| Tested | assignToPatient | passed == true 且 HOSPITAL_ROLE |
| Assigned | 无 | 终态 |

## 五、安全设计

| 安全机制 | 实现方式 | 防护目标 |
|----------|----------|----------|
| 角色权限 | OpenZeppelin AccessControl（4 业务角色 + 管理员） | 防止越权操作 |
| 重入防护 | ReentrancyGuard + CEI 模式 | 防止重入攻击 |
| 暂停机制 | Pausable（代币全量暂停 / 平台登记与兑换暂停） | 应急风控 |
| 铸造权限 | minter 仅限平台合约 | 防止任意超发积分 |
| 状态校验 | require 检查前置状态 | 防止非法状态跳转 |
| 参数验证 | require 检查输入有效性 | 防止无效数据写入 |
| 整数溢出 | Solidity 0.8 内置检查 | 防止数值异常 |

## 六、Gas 优化考虑

| 操作 | 优化策略 |
|------|----------|
| 排行榜排序 | 冒泡排序（链上），适合小规模数据；大规模可改为链下排序 |
| 血液查询 | 按血型/状态建立索引，避免全量遍历 |
| 事件记录 | 使用 indexed 参数优化日志检索 |
| 前端写操作 | 统一显式 gasLimit（Sepolia 不接受默认估算值） |
