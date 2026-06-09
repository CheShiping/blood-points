# 区块链特性应用说明

## 一、为什么选择区块链？

传统献血积分系统存在以下痛点：

| 问题 | 传统方案 | 区块链方案 |
|------|----------|------------|
| 积分数据可被管理员篡改 | 中心化数据库，管理员可随意修改 | 链上存储，任何人无法单方面篡改 |
| 血液流转记录可被删除 | 日志可被清除或修改 | 链上记录永久存在，不可删除 |
| 多机构协作需要互信 | 依赖中心化第三方背书 | 智能合约自动执行，无需互信 |
| 数据透明度低 | 用户无法验证数据真实性 | 所有交易公开可验证 |

## 二、链上 vs 链下数据划分

### 链上数据（存储在区块链）

| 数据类型 | 存储位置 | 上链理由 |
|----------|----------|----------|
| 用户积分 | `mapping(address => uint256) userPoints` | 积分是核心资产，必须不可篡改 |
| 血液记录 | `mapping(uint256 => BloodUnit) bloodUnits` | 血液溯源需要永久、可追溯的记录 |
| 血液状态 | `BloodUnit.status` | 状态机转换必须严格校验、不可回退 |
| 血站流转 | `mapping(uint256 => BloodTransfer[]) bloodTransfers` | 多机构协作记录，需要多方可验证 |
| 商品信息 | `mapping(uint256 => Product) products` | 商品库存和价格需要透明 |
| 角色权限 | `mapping(address => Role) roles` | 权限控制必须由合约强制执行 |
| 事件日志 | `event PointsAwarded/BloodCreated/...` | 链上事件可用于审计和追踪 |

### 链下数据（前端/服务器）

| 数据类型 | 存储位置 | 不上链理由 |
|----------|----------|------------|
| 前端 UI | 用户浏览器 | 界面渲染不需要链上存储 |
| 用户会话 | RainbowKit/wagmi | 临时状态，无需上链 |
| ABI 文件 | 前端代码 | 合约接口描述，不涉及业务状态 |
| IPFS 图片 | IPFS 网络（可选） | 大文件存储成本高，可用哈希锚定 |

## 三、区块链特性在项目中的体现

### 1. 去中心化

- 合约部署在以太坊网络，不依赖单一服务器
- 任何节点均可验证交易有效性
- 无单点故障风险

**代码体现：**
```solidity
// 合约继承 Ownable，但核心业务逻辑不依赖中心化服务器
contract BloodPoints is Ownable, ReentrancyGuard {
    // 积分数据存储在链上，不由任何中心化机构控制
    mapping(address => uint256) public userPoints;
}
```

### 2. 不可篡改

- 一旦交易确认，数据永久写入区块链
- 积分增减、血液状态变更均有交易记录
- 管理员无法回滚或修改历史数据

**代码体现：**
```solidity
// 积分只能通过合约函数增减，无法直接修改 mapping
function donateBlood(string calldata bloodType, uint256 volume) external nonReentrant {
    userPoints[msg.sender] += POINTS_PER_DONATION;  // 链上永久记录
}
```

### 3. 可追溯

- 每笔血液记录包含时间戳和完整流转链
- `getBloodJourney()` 可查询血液从献血到分配的全过程
- 事件日志支持链下审计

**代码体现：**
```solidity
struct BloodUnit {
    uint256 donatedAt;   // 献血时间
    uint256 testedAt;    // 检测时间
    uint256 assignedAt;  // 分配时间
    BloodStatus status;  // 当前状态
}

// 完整流转记录
mapping(uint256 => BloodTransfer[]) public bloodTransfers;
```

### 4. 多方协作共识

- 采集员、血站、献血者各司其职
- 角色权限由合约强制执行，不依赖人为信任
- 状态机校验确保业务流程不可跳跃

**代码体现：**
```solidity
// 角色权限检查
modifier onlyRole(Role required) {
    require(roles[msg.sender] == required, "Caller does not have required role");
    _;
}

// 状态机严格校验
function testBlood(uint256 bloodId, bool passed) external onlyRole(Role.BloodBank) {
    require(unit.status == BloodStatus.Received, "Blood must be received before testing");
    // 只有 Received 状态才能进入 Tested
}
```

## 四、状态机设计

血液状态转换是本项目的核心业务逻辑，完全由智能合约强制执行：

```
Donated（已献血）
    │
    ▼
Received（血站接收）←── 可多次流转（多血站间转移）
    │
    ▼
Tested（已检测）
    │
    ├── passed = true ──▶ Assigned（已分配给病人）
    │
    └── passed = false ──▶ 终止（不可分配）
```

**状态转换规则：**

| 当前状态 | 允许的操作 | 前置条件 |
|----------|------------|----------|
| Donated | receiveBlood | 无 |
| Received | receiveBlood（转移到其他血站） | 无 |
| Received | testBlood | 无 |
| Tested | assignToPatient | passed == true |
| Assigned | 无 | 终态 |

## 五、安全设计

| 安全机制 | 实现方式 | 防护目标 |
|----------|----------|----------|
| 权限控制 | OpenZeppelin Ownable + 自定义 Role | 防止越权操作 |
| 重入防护 | ReentrancyGuard | 防止重入攻击 |
| 状态校验 | require 检查前置状态 | 防止非法状态跳转 |
| 参数验证 | require 检查输入有效性 | 防止无效数据写入 |
| 整数溢出 | Solidity 0.8 内置检查 | 防止数值异常 |

## 六、Gas 优化考虑

| 操作 | 优化策略 |
|------|----------|
| 排行榜排序 | 冒泡排序（链上），适合小规模数据；大规模可改为链下排序 |
| 血液查询 | 按血型/状态建立索引，避免全量遍历 |
| 事件记录 | 使用 indexed 参数优化日志检索 |
