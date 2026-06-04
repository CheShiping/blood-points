# Blood Tracking Feature Design

## Overview

为 BloodPoints DApp 新增血液流转追踪功能。用户可以查询自己捐献的血液经过了哪些血站、检测结果如何、最终分配给了哪位病人。利用区块链的不可篡改性和透明性，实现血液从献血者到病人的完整链路追溯。

**核心价值：** 每一步流转都上链记录，任何人可审计，不可篡改。

## Scope

- 扩展现有 `BloodPoints.sol` 合约，新增血液追踪数据结构和函数
- 新增前端 `BloodTracking.tsx` 组件，展示血液流转时间线
- 一键模拟功能，演示完整流转流程
- 补充 BloodPoints 合约测试

## Data Model

### 血液状态枚举

```solidity
enum BloodStatus { Donated, Received, Tested, Assigned }
```

- `Donated` — 初始状态，献血者完成献血
- `Received` — 血站接收，可多次触发（支持多血站流转）
- `Tested` — 某血站完成检测
- `Assigned` — 已分配给病人

### 血液单元结构体

```solidity
struct BloodUnit {
    uint256 bloodId;
    address donor;          // 献血者地址
    uint256 volume;         // 献血量(ml)
    string bloodType;       // 血型: A/B/AB/O
    bool testedPassed;      // 检测是否合格
    address patient;        // 分配的病人地址（Assigned阶段才有）
    BloodStatus status;     // 当前状态
    uint256 donatedAt;      // 献血时间戳
    uint256 testedAt;       // 检测时间戳
    uint256 assignedAt;     // 分配时间戳
}
```

### 血站流转记录

```solidity
struct BloodTransfer {
    string bloodBank;       // 血站名称
    uint256 receivedAt;     // 接收时间戳
    uint256 transferredAt;  // 转出时间戳（0表示当前所在血站）
}
```

### 存储映射

```solidity
mapping(uint256 => BloodUnit) public bloodUnits;
mapping(uint256 => BloodTransfer[]) public bloodTransfers;  // bloodId => 流转记录数组
mapping(address => uint256[]) public donorBloodIds;          // 献血者 => 血液ID列表
mapping(address => uint256[]) public patientBloodIds;        // 病人 => 收到的血液ID列表
uint256 public nextBloodId;
```

## Contract Functions

### 状态变更函数（onlyOwner）

| 函数 | 前置条件 | 说明 |
|------|---------|------|
| `receiveBlood(bloodId, bloodBank)` | status == Donated 或 Received | 血站接收，创建 BloodTransfer 记录 |
| `testBlood(bloodId, passed)` | status == Received | 检测血液，passed=false 时血液标记为不合格 |
| `assignToPatient(bloodId, patientAddress)` | status == Tested && testedPassed | 分配给病人 |

### 查询函数（view）

| 函数 | 返回 | 说明 |
|------|------|------|
| `getBloodUnit(bloodId)` | BloodUnit | 查询单袋血液详情 |
| `getBloodTransfers(bloodId)` | BloodTransfer[] | 查询血液的完整血站流转链路 |
| `getDonorBloods(address)` | uint256[] | 查询某献血者的所有血液ID |
| `getPatientBloods(address)` | uint256[] | 查询某病人收到的所有血液ID |
| `getBloodJourney(bloodId)` | (BloodUnit, BloodTransfer[]) | 一站式返回血液详情和流转链路 |

### 事件

```solidity
event BloodCreated(uint256 indexed bloodId, address indexed donor, string bloodType, uint256 volume);
event BloodReceived(uint256 indexed bloodId, string bloodBank, uint256 timestamp);
event BloodTested(uint256 indexed bloodId, bool passed, uint256 timestamp);
event BloodAssigned(uint256 indexed bloodId, address indexed patient, uint256 timestamp);
```

### 与现有 donateBlood() 的集成

在现有 `donateBlood()` 函数中增加参数 `bloodType` 和 `volume`，函数末尾自动创建 `BloodUnit` 记录：

```solidity
function donateBlood(string calldata bloodType, uint256 volume) external {
    // ... 现有积分逻辑保持不变 ...

    // 新增：创建血液追踪记录
    uint256 bloodId = nextBloodId++;
    bloodUnits[bloodId] = BloodUnit({
        bloodId: bloodId,
        donor: msg.sender,
        volume: volume,
        bloodType: bloodType,
        testedPassed: false,
        patient: address(0),
        status: BloodStatus.Donated,
        donatedAt: block.timestamp,
        testedAt: 0,
        assignedAt: 0
    });
    donorBloodIds[msg.sender].push(bloodId);

    emit BloodCreated(bloodId, msg.sender, bloodType, volume);
}
```

## State Machine

```
Donated ──→ Received ──→ Received ──→ Tested ──→ Assigned
  │           (血站A)      (血站B)      (检测合格)   (分配病人)
  │                                     │
  │                                     └──→ (testedPassed=false)
  │                                           血液标记为不合格，无法分配
```

**状态转换规则：**
- `Donated` → `Received`：任何血站可接收
- `Received` → `Received`：可转到下一个血站
- `Received` → `Tested`：只能在某个血站检测一次
- `Tested` → `Assigned`：仅当 `testedPassed == true`
- 不允许任何回退

## Frontend Design

### 新增组件：BloodTracking.tsx

位于 `frontend/src/components/BloodTracking.tsx`。

**页面结构：**

1. **我的血液记录区域**
   - 连接钱包后自动调用 `getDonorBloods(myAddress)` 获取血液ID列表
   - 逐个调用 `getBloodUnit(bloodId)` 展示卡片列表
   - 每张卡片显示：血液ID、血型、献血量、当前状态（带颜色标签）、献血时间

2. **血液详情展开/弹窗**
   - 点击某袋血液，调用 `getBloodJourney(bloodId)` 获取完整信息
   - 以时间线形式展示流转链路：
     ```
     🩸 血液 #001 (A型, 300ml)
     ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
     │   献血者     │ →  │  血站 A     │ →  │  血站 B     │ →  │   病人      │
     │  0x1234..   │    │  接收/转出  │    │  接收/检测  │    │  0x5678..   │
     │  2026-06-04 │    │  2026-06-05 │    │  2026-06-06 │    │  2026-06-07 │
     └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
     ```
   - 每个节点显示血站名称、接收时间、转出时间
   - 当前所在节点高亮

3. **一键模拟面板**（仅 owner 可见）
   - 表单输入：血型选择、血量输入、血站名称（可输入多个，逗号分隔）、病人地址
   - "模拟完整流转"按钮：
     1. 调用 `donateBlood(bloodType, volume)` 创建血液记录
     2. 依次调用 `receiveBlood(bloodId, bloodBank)` 经过每个血站
     3. 调用 `testBlood(bloodId, true)` 检测合格
     4. 调用 `assignToPatient(bloodId, patientAddress)` 分配给病人
   - 每步交易确认后自动推进，前端显示进度条/步骤指示器
   - 全部完成后自动刷新血液记录

4. **导航入口**
   - 在 `WalletConnect.tsx` 导航栏添加"血液追踪"按钮/链接
   - 在 `App.tsx` 中添加 `BloodTracking` 组件的路由/条件渲染

### 样式

复用 `index.css` 中的 CSS 自定义变量（`--primary-color`、`--bg-card` 等）和动画风格，保持与现有页面视觉一致。

## Testing

### 测试文件

新建 `test/BloodPoints.ts`，使用 Hardhat + viem 测试框架，风格与 `test/Counter.ts` 一致。

### 测试用例

**正常流转路径：**
- 献血后自动创建 BloodUnit，状态为 Donated
- 单血站流转：Donated → Received → Tested → Assigned
- 多血站流转：Donated → Received(A站) → Received(B站) → Tested → Assigned
- 查询献血者的血液列表
- 查询病人的血液列表
- 查询完整流转链路

**状态校验：**
- Donated 状态不能直接调用 testBlood
- Received 状态不能直接调用 assignToPatient
- Tested 且 passed=false 时不能分配
- 不允许状态回退（Assigned 不能再调用 receiveBlood）

**权限控制：**
- 非 owner 调用 receiveBlood 应 revert
- 非 owner 调用 testBlood 应 revert
- 非 owner 调用 assignToPatient 应 revert

**边界情况：**
- 不存在的 bloodId 应 revert
- 重复分配同一袋血液应 revert
- 检测不合格的血液无法分配

## Breaking Changes

- `donateBlood()` 函数签名从 `donateBlood()` 变为 `donateBlood(string calldata bloodType, uint256 volume)`。现有 `frontend/src/components/BloodDonation.tsx` 中的 `useWriteContract` 调用必须同步更新，增加血型选择和献血量输入框。

## File Changes Summary

| 文件 | 操作 | 说明 |
|------|------|------|
| `contracts/BloodPoints.sol` | 修改 | 新增血液追踪数据结构、函数、事件，修改 donateBlood 签名 |
| `frontend/src/components/BloodDonation.tsx` | 修改 | 更新 donateBlood 调用，增加血型和血量输入 |
| `frontend/src/components/BloodTracking.tsx` | 新建 | 血液追踪页面组件 |
| `frontend/src/components/WalletConnect.tsx` | 修改 | 导航栏添加"血液追踪"入口 |
| `frontend/src/App.tsx` | 修改 | 添加 BloodTracking 组件的条件渲染 |
| `frontend/src/contracts/BloodPoints.json` | 修改 | 重新导出 ABI（运行 export-abi.ts） |
| `test/BloodPoints.ts` | 新建 | BloodPoints 合约完整测试 |
