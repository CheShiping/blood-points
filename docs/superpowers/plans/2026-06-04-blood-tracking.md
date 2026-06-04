# Blood Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add blood traceability to BloodPoints — track each blood unit from donation through multiple blood banks to patient assignment, all on-chain.

**Architecture:** Extend existing `BloodPoints.sol` with a `BloodUnit` struct and `BloodTransfer` records. A 4-stage state machine (Donated → Received → Tested → Assigned) governs transitions. Frontend adds a `BloodTracking.tsx` component with timeline visualization and one-click simulation. Existing `donateBlood()` signature changes to accept blood type and volume.

**Tech Stack:** Solidity 0.8.28, Hardhat 3, viem, React 19, wagmi 2, RainbowKit 2, TypeScript

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `contracts/BloodPoints.sol` | Modify | Add blood tracking structs, state machine, query functions, events; update `donateBlood()` |
| `test/BloodPoints.ts` | Create | Full contract test suite for points + blood tracking |
| `frontend/src/contracts/BloodPoints.json` | Regenerate | ABI after contract changes |
| `frontend/src/components/BloodDonation.tsx` | Modify | Add blood type + volume inputs to match new `donateBlood()` signature |
| `frontend/src/components/BloodTracking.tsx` | Create | Blood tracking page: my bloods, timeline, simulation panel |
| `frontend/src/components/WalletConnect.tsx` | Modify | Add "血液追踪" nav link |
| `frontend/src/App.tsx` | Modify | Add BloodTracking section |
| `frontend/src/index.css` | Modify | Add timeline and simulation panel styles |

---

## Task 1: Extend BloodPoints.sol with blood tracking data model

**Files:**
- Modify: `contracts/BloodPoints.sol`

- [ ] **Step 1: Add the BloodStatus enum, BloodUnit struct, and BloodTransfer struct after the existing Product struct**

Add these after line 16 (after the Product struct closing brace):

```solidity
  /// @notice 血液状态枚举
  enum BloodStatus { Donated, Received, Tested, Assigned }

  /// @notice 血液单元结构体
  struct BloodUnit {
    uint256 bloodId;
    address donor;
    uint256 volume;
    string bloodType;
    bool testedPassed;
    address patient;
    BloodStatus status;
    uint256 donatedAt;
    uint256 testedAt;
    uint256 assignedAt;
  }

  /// @notice 血站流转记录
  struct BloodTransfer {
    string bloodBank;
    uint256 receivedAt;
    uint256 transferredAt;
  }
```

- [ ] **Step 2: Add blood tracking state variables after the existing state variables (after `POINTS_PER_DONATION` on line 36)**

```solidity
  /// @notice 血液ID到血液单元的映射
  mapping(uint256 => BloodUnit) public bloodUnits;

  /// @notice 血液ID到血站流转记录的映射
  mapping(uint256 => BloodTransfer[]) public bloodTransfers;

  /// @notice 献血者地址到血液ID列表的映射
  mapping(address => uint256[]) public donorBloodIds;

  /// @notice 病人地址到收到的血液ID列表的映射
  mapping(address => uint256[]) public patientBloodIds;

  /// @notice 下一个血液ID
  uint256 public nextBloodId;
```

- [ ] **Step 3: Add blood tracking events after the existing events (after `PointsTransferred` on line 47)**

```solidity
  /// @notice 血液创建事件
  event BloodCreated(uint256 indexed bloodId, address indexed donor, string bloodType, uint256 volume);

  /// @notice 血站接收事件
  event BloodReceived(uint256 indexed bloodId, string bloodBank, uint256 timestamp);

  /// @notice 血液检测事件
  event BloodTested(uint256 indexed bloodId, bool passed, uint256 timestamp);

  /// @notice 血液分配事件
  event BloodAssigned(uint256 indexed bloodId, address indexed patient, uint256 timestamp);
```

- [ ] **Step 4: Update the `donateBlood()` function signature to accept bloodType and volume, and add blood unit creation**

Replace the existing `donateBlood()` function (lines 59-70) with:

```solidity
  /// @notice 用户献血获取积分
  /// @param bloodType 血型 (A/B/AB/O)
  /// @param volume 献血量(ml)
  function donateBlood(string calldata bloodType, uint256 volume) external nonReentrant {
    require(bytes(bloodType).length > 0, "Blood type cannot be empty");
    require(volume > 0, "Volume must be greater than 0");

    // 发放积分
    userPoints[msg.sender] += POINTS_PER_DONATION;

    // 如果是首次献血，记录到献血者列表
    if (!isDonor[msg.sender]) {
      isDonor[msg.sender] = true;
      allDonors.push(msg.sender);
    }

    // 创建血液追踪记录
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

    emit PointsAwarded(msg.sender, POINTS_PER_DONATION);
    emit BloodCreated(bloodId, msg.sender, bloodType, volume);
  }
```

- [ ] **Step 5: Commit**

```bash
git add contracts/BloodPoints.sol
git commit -m "feat(contract): add blood tracking data model and update donateBlood signature"
```

---

## Task 2: Add blood tracking state transition functions

**Files:**
- Modify: `contracts/BloodPoints.sol`

- [ ] **Step 1: Add `receiveBlood`, `testBlood`, and `assignToPatient` functions after the `donateBlood` function**

```solidity
  // ==================== 血液流转功能 ====================

  /// @notice 血站接收血液
  /// @param bloodId 血液ID
  /// @param bloodBank 血站名称
  function receiveBlood(uint256 bloodId, string calldata bloodBank) external onlyOwner {
    BloodUnit storage unit = bloodUnits[bloodId];
    require(unit.bloodId == bloodId, "Blood unit does not exist");
    require(
      unit.status == BloodStatus.Donated || unit.status == BloodStatus.Received,
      "Blood cannot be received in current status"
    );
    require(bytes(bloodBank).length > 0, "Blood bank name cannot be empty");

    // 如果是从 Received 转出，更新上一条记录的 transferredAt
    if (unit.status == BloodStatus.Received && bloodTransfers[bloodId].length > 0) {
      bloodTransfers[bloodId][bloodTransfers[bloodId].length - 1].transferredAt = block.timestamp;
    }

    unit.status = BloodStatus.Received;
    bloodTransfers[bloodId].push(BloodTransfer({
      bloodBank: bloodBank,
      receivedAt: block.timestamp,
      transferredAt: 0
    }));

    emit BloodReceived(bloodId, bloodBank, block.timestamp);
  }

  /// @notice 血站检测血液
  /// @param bloodId 血液ID
  /// @param passed 检测是否合格
  function testBlood(uint256 bloodId, bool passed) external onlyOwner {
    BloodUnit storage unit = bloodUnits[bloodId];
    require(unit.bloodId == bloodId, "Blood unit does not exist");
    require(unit.status == BloodStatus.Received, "Blood must be received before testing");

    unit.status = BloodStatus.Tested;
    unit.testedPassed = passed;
    unit.testedAt = block.timestamp;

    // 更新当前血站的 transferredAt
    if (bloodTransfers[bloodId].length > 0) {
      bloodTransfers[bloodId][bloodTransfers[bloodId].length - 1].transferredAt = block.timestamp;
    }

    emit BloodTested(bloodId, passed, block.timestamp);
  }

  /// @notice 分配血液给病人
  /// @param bloodId 血液ID
  /// @param patientAddress 病人地址
  function assignToPatient(uint256 bloodId, address patientAddress) external onlyOwner {
    BloodUnit storage unit = bloodUnits[bloodId];
    require(unit.bloodId == bloodId, "Blood unit does not exist");
    require(unit.status == BloodStatus.Tested, "Blood must be tested before assignment");
    require(unit.testedPassed, "Blood test must pass before assignment");
    require(patientAddress != address(0), "Invalid patient address");

    unit.status = BloodStatus.Assigned;
    unit.patient = patientAddress;
    unit.assignedAt = block.timestamp;
    patientBloodIds[patientAddress].push(bloodId);

    emit BloodAssigned(bloodId, patientAddress, block.timestamp);
  }
```

- [ ] **Step 2: Commit**

```bash
git add contracts/BloodPoints.sol
git commit -m "feat(contract): add blood tracking state transition functions"
```

---

## Task 3: Add blood tracking query functions

**Files:**
- Modify: `contracts/BloodPoints.sol`

- [ ] **Step 1: Add query functions after the state transition functions, before the closing brace of the contract**

```solidity
  // ==================== 血液查询功能 ====================

  /// @notice 查询血液单元详情
  /// @param bloodId 血液ID
  /// @return 血液单元完整信息
  function getBloodUnit(uint256 bloodId) external view returns (BloodUnit memory) {
    require(bloodUnits[bloodId].bloodId == bloodId, "Blood unit does not exist");
    return bloodUnits[bloodId];
  }

  /// @notice 查询血液的血站流转记录
  /// @param bloodId 血液ID
  /// @return 血站流转记录数组
  function getBloodTransfers(uint256 bloodId) external view returns (BloodTransfer[] memory) {
    require(bloodUnits[bloodId].bloodId == bloodId, "Blood unit does not exist");
    return bloodTransfers[bloodId];
  }

  /// @notice 查询献血者的所有血液ID
  /// @param donor 献血者地址
  /// @return 血液ID数组
  function getDonorBloods(address donor) external view returns (uint256[] memory) {
    return donorBloodIds[donor];
  }

  /// @notice 查询病人收到的所有血液ID
  /// @param patient 病人地址
  /// @return 血液ID数组
  function getPatientBloods(address patient) external view returns (uint256[] memory) {
    return patientBloodIds[patient];
  }

  /// @notice 一站式查询血液完整流转信息
  /// @param bloodId 血液ID
  /// @return unit 血液单元信息
  /// @return transfers 血站流转记录
  function getBloodJourney(uint256 bloodId)
    external
    view
    returns (BloodUnit memory unit, BloodTransfer[] memory transfers)
  {
    require(bloodUnits[bloodId].bloodId == bloodId, "Blood unit does not exist");
    return (bloodUnits[bloodId], bloodTransfers[bloodId]);
  }
```

- [ ] **Step 2: Compile the contract to verify no errors**

Run: `npx hardhat compile`
Expected: Compiled successfully

- [ ] **Step 3: Commit**

```bash
git add contracts/BloodPoints.sol
git commit -m "feat(contract): add blood tracking query functions"
```

---

## Task 4: Write BloodPoints contract tests

**Files:**
- Create: `test/BloodPoints.ts`

- [ ] **Step 1: Create the test file with the full test suite**

```typescript
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { network } from "hardhat";

describe("BloodPoints", async function () {
  const { viem } = await network.create();
  const publicClient = await viem.getPublicClient();

  // ==================== 积分功能测试 ====================

  describe("Points System", async function () {
    it("Should award 100 points per donation", async function () {
      const contract = await viem.deployContract("BloodPoints");
      const [donor] = await viem.getWalletClients();

      await contract.write.donateBlood(["A", 300]);
      const points = await contract.read.getPoints([donor.account.address]);
      assert.equal(points, 100n);
    });

    it("Should accumulate points across multiple donations", async function () {
      const contract = await viem.deployContract("BloodPoints");
      const [donor] = await viem.getWalletClients();

      await contract.write.donateBlood(["A", 300]);
      await contract.write.donateBlood(["B", 200]);
      const points = await contract.read.getPoints([donor.account.address]);
      assert.equal(points, 200n);
    });

    it("Should track first-time donors in leaderboard", async function () {
      const contract = await viem.deployContract("BloodPoints");
      const [donor] = await viem.getWalletClients();

      await contract.write.donateBlood(["A", 300]);
      const count = await contract.read.getDonorCount();
      assert.equal(count, 1n);

      const isDonor = await contract.read.isDonor([donor.account.address]);
      assert.equal(isDonor, true);
    });

    it("Should not duplicate donors on second donation", async function () {
      const contract = await viem.deployContract("BloodPoints");

      await contract.write.donateBlood(["A", 300]);
      await contract.write.donateBlood(["B", 200]);
      const count = await contract.read.getDonorCount();
      assert.equal(count, 1n);
    });

    it("Should transfer points between users", async function () {
      const contract = await viem.deployContract("BloodPoints");
      const [donor, recipient] = await viem.getWalletClients();

      await contract.write.donateBlood(["A", 300]);
      await contract.write.transferPoints([recipient.account.address, 50]);

      const donorPoints = await contract.read.getPoints([donor.account.address]);
      const recipientPoints = await contract.read.getPoints([recipient.account.address]);
      assert.equal(donorPoints, 50n);
      assert.equal(recipientPoints, 50n);
    });

    it("Should reject transfer to self", async function () {
      const contract = await viem.deployContract("BloodPoints");
      const [donor] = await viem.getWalletClients();

      await contract.write.donateBlood(["A", 300]);
      await assert.rejects(
        contract.write.transferPoints([donor.account.address, 50]),
        /Cannot transfer to yourself/
      );
    });

    it("Should reject transfer with insufficient points", async function () {
      const contract = await viem.deployContract("BloodPoints");
      const [, recipient] = await viem.getWalletClients();

      await assert.rejects(
        contract.write.transferPoints([recipient.account.address, 50]),
        /Insufficient points/
      );
    });
  });

  // ==================== 血液追踪测试 ====================

  describe("Blood Tracking", async function () {
    it("Should create blood unit on donation", async function () {
      const contract = await viem.deployContract("BloodPoints");
      const [donor] = await viem.getWalletClients();

      await contract.write.donateBlood(["A", 300]);

      const unit = await contract.read.getBloodUnit([0n]);
      assert.equal(unit.bloodId, 0n);
      assert.equal(unit.donor, donor.account.address);
      assert.equal(unit.volume, 300n);
      assert.equal(unit.bloodType, "A");
      assert.equal(unit.status, 0); // Donated
      assert.equal(unit.testedPassed, false);
    });

    it("Should track donor blood IDs", async function () {
      const contract = await viem.deployContract("BloodPoints");
      const [donor] = await viem.getWalletClients();

      await contract.write.donateBlood(["A", 300]);
      await contract.write.donateBlood(["B", 200]);

      const bloodIds = await contract.read.getDonorBloods([donor.account.address]);
      assert.deepEqual(bloodIds, [0n, 1n]);
    });

    it("Should complete single blood bank flow", async function () {
      const contract = await viem.deployContract("BloodPoints");
      const [, , patient] = await viem.getWalletClients();

      await contract.write.donateBlood(["A", 300]);
      await contract.write.receiveBlood([0n, "血站A"]);
      await contract.write.testBlood([0n, true]);
      await contract.write.assignToPatient([0n, patient.account.address]);

      const unit = await contract.read.getBloodUnit([0n]);
      assert.equal(unit.status, 3); // Assigned
      assert.equal(unit.testedPassed, true);
      assert.equal(unit.patient, patient.account.address);
    });

    it("Should complete multi blood bank flow", async function () {
      const contract = await viem.deployContract("BloodPoints");
      const [, , patient] = await viem.getWalletClients();

      await contract.write.donateBlood(["O", 400]);
      await contract.write.receiveBlood([0n, "血站A"]);
      await contract.write.receiveBlood([0n, "血站B"]);
      await contract.write.testBlood([0n, true]);
      await contract.write.assignToPatient([0n, patient.account.address]);

      const unit = await contract.read.getBloodUnit([0n]);
      assert.equal(unit.status, 3); // Assigned

      const transfers = await contract.read.getBloodTransfers([0n]);
      assert.equal(transfers.length, 2);
      assert.equal(transfers[0].bloodBank, "血站A");
      assert.equal(transfers[1].bloodBank, "血站B");
    });

    it("Should return full blood journey", async function () {
      const contract = await viem.deployContract("BloodPoints");
      const [donor] = await viem.getWalletClients();

      await contract.write.donateBlood(["AB", 200]);
      await contract.write.receiveBlood([0n, "血站A"]);

      const [unit, transfers] = await contract.read.getBloodJourney([0n]);
      assert.equal(unit.bloodId, 0n);
      assert.equal(unit.donor, donor.account.address);
      assert.equal(transfers.length, 1);
      assert.equal(transfers[0].bloodBank, "血站A");
    });

    it("Should track patient blood IDs", async function () {
      const contract = await viem.deployContract("BloodPoints");
      const [, , patient] = await viem.getWalletClients();

      await contract.write.donateBlood(["A", 300]);
      await contract.write.receiveBlood([0n, "血站A"]);
      await contract.write.testBlood([0n, true]);
      await contract.write.assignToPatient([0n, patient.account.address]);

      const bloodIds = await contract.read.getPatientBloods([patient.account.address]);
      assert.deepEqual(bloodIds, [0n]);
    });

    it("Should emit BloodCreated event", async function () {
      const contract = await viem.deployContract("BloodPoints");

      await viem.assertions.emitWithArgs(
        contract.write.donateBlood(["A", 300]),
        contract,
        "BloodCreated",
        [0n, (await viem.getWalletClients())[0].account.address, "A", 300n]
      );
    });

    it("Should emit BloodReceived event", async function () {
      const contract = await viem.deployContract("BloodPoints");

      await contract.write.donateBlood(["A", 300]);
      await viem.assertions.emitWithArgs(
        contract.write.receiveBlood([0n, "血站A"]),
        contract,
        "BloodReceived",
        [0n, "血站A", await publicClient.getBlock().then(b => b.timestamp)]
      );
    });

    it("Should emit BloodAssigned event", async function () {
      const contract = await viem.deployContract("BloodPoints");
      const [, , patient] = await viem.getWalletClients();

      await contract.write.donateBlood(["A", 300]);
      await contract.write.receiveBlood([0n, "血站A"]);
      await contract.write.testBlood([0n, true]);

      await viem.assertions.emitWithArgs(
        contract.write.assignToPatient([0n, patient.account.address]),
        contract,
        "BloodAssigned",
        [0n, patient.account.address, await publicClient.getBlock().then(b => b.timestamp)]
      );
    });
  });

  // ==================== 状态校验测试 ====================

  describe("State Machine Validation", async function () {
    it("Should reject testBlood on Donated blood", async function () {
      const contract = await viem.deployContract("BloodPoints");

      await contract.write.donateBlood(["A", 300]);
      await assert.rejects(
        contract.write.testBlood([0n, true]),
        /Blood must be received before testing/
      );
    });

    it("Should reject assignToPatient on Received blood", async function () {
      const contract = await viem.deployContract("BloodPoints");
      const [, , patient] = await viem.getWalletClients();

      await contract.write.donateBlood(["A", 300]);
      await contract.write.receiveBlood([0n, "血站A"]);
      await assert.rejects(
        contract.write.assignToPatient([0n, patient.account.address]),
        /Blood must be tested before assignment/
      );
    });

    it("Should reject assignToPatient when test failed", async function () {
      const contract = await viem.deployContract("BloodPoints");
      const [, , patient] = await viem.getWalletClients();

      await contract.write.donateBlood(["A", 300]);
      await contract.write.receiveBlood([0n, "血站A"]);
      await contract.write.testBlood([0n, false]);
      await assert.rejects(
        contract.write.assignToPatient([0n, patient.account.address]),
        /Blood test must pass before assignment/
      );
    });

    it("Should reject receiveBlood on Tested blood", async function () {
      const contract = await viem.deployContract("BloodPoints");

      await contract.write.donateBlood(["A", 300]);
      await contract.write.receiveBlood([0n, "血站A"]);
      await contract.write.testBlood([0n, true]);
      await assert.rejects(
        contract.write.receiveBlood([0n, "血站B"]),
        /Blood cannot be received in current status/
      );
    });

    it("Should reject receiveBlood on Assigned blood", async function () {
      const contract = await viem.deployContract("BloodPoints");
      const [, , patient] = await viem.getWalletClients();

      await contract.write.donateBlood(["A", 300]);
      await contract.write.receiveBlood([0n, "血站A"]);
      await contract.write.testBlood([0n, true]);
      await contract.write.assignToPatient([0n, patient.account.address]);
      await assert.rejects(
        contract.write.receiveBlood([0n, "血站B"]),
        /Blood cannot be received in current status/
      );
    });

    it("Should reject duplicate assignment", async function () {
      const contract = await viem.deployContract("BloodPoints");
      const [, , patient] = await viem.getWalletClients();

      await contract.write.donateBlood(["A", 300]);
      await contract.write.receiveBlood([0n, "血站A"]);
      await contract.write.testBlood([0n, true]);
      await contract.write.assignToPatient([0n, patient.account.address]);
      await assert.rejects(
        contract.write.assignToPatient([0n, patient.account.address]),
        /Blood must be tested before assignment/
      );
    });

    it("Should reject non-existent bloodId", async function () {
      const contract = await viem.deployContract("BloodPoints");

      await assert.rejects(
        contract.write.getBloodUnit([999n]),
        /Blood unit does not exist/
      );
    });
  });

  // ==================== 权限控制测试 ====================

  describe("Access Control", async function () {
    it("Should reject receiveBlood from non-owner", async function () {
      const contract = await viem.deployContract("BloodPoints");
      const [, nonOwner] = await viem.getWalletClients();

      await contract.write.donateBlood(["A", 300]);
      await assert.rejects(
        contract.write.receiveBlood([0n, "血站A"], { account: nonOwner.account }),
        /OwnableUnauthorizedAccount/
      );
    });

    it("Should reject testBlood from non-owner", async function () {
      const contract = await viem.deployContract("BloodPoints");
      const [, nonOwner] = await viem.getWalletClients();

      await contract.write.donateBlood(["A", 300]);
      await contract.write.receiveBlood([0n, "血站A"]);
      await assert.rejects(
        contract.write.testBlood([0n, true], { account: nonOwner.account }),
        /OwnableUnauthorizedAccount/
      );
    });

    it("Should reject assignToPatient from non-owner", async function () {
      const contract = await viem.deployContract("BloodPoints");
      const [, nonOwner, patient] = await viem.getWalletClients();

      await contract.write.donateBlood(["A", 300]);
      await contract.write.receiveBlood([0n, "血站A"]);
      await contract.write.testBlood([0n, true]);
      await assert.rejects(
        contract.write.assignToPatient([0n, patient.account.address], { account: nonOwner.account }),
        /OwnableUnauthorizedAccount/
      );
    });
  });

  // ==================== 商品功能测试 ====================

  describe("Product Management", async function () {
    it("Should add and redeem product", async function () {
      const contract = await viem.deployContract("BloodPoints");

      await contract.write.donateBlood(["A", 300]);
      await contract.write.addNewProduct(["T恤", 50, 10]);
      await contract.write.redeemProduct([0n]);

      const points = await contract.read.getPoints([(await viem.getWalletClients())[0].account.address]);
      assert.equal(points, 50n);

      const product = await contract.read.getProduct([0n]);
      assert.equal(product.stock, 9n);
    });

    it("Should reject redeem with insufficient points", async function () {
      const contract = await viem.deployContract("BloodPoints");

      await contract.write.addNewProduct(["T恤", 200, 10]);
      await assert.rejects(
        contract.write.redeemProduct([0n]),
        /Insufficient points/
      );
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they pass**

Run: `npx hardhat test`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add test/BloodPoints.ts
git commit -m "test: add comprehensive BloodPoints contract tests"
```

---

## Task 5: Export updated ABI and update frontend contract config

**Files:**
- Regenerate: `frontend/src/contracts/BloodPoints.json`
- Verify: `frontend/src/contracts/config.ts` (no changes needed)

- [ ] **Step 1: Export the ABI from Hardhat artifacts**

Run: `npx hardhat run scripts/export-abi.ts`
Expected: `ABI exported to frontend/src/contracts/BloodPoints.json`

- [ ] **Step 2: Verify the exported ABI contains the new functions**

Run: `grep -c "receiveBlood\|testBlood\|assignToPatient\|getBloodUnit\|getBloodJourney" frontend/src/contracts/BloodPoints.json`
Expected: Should find matches (at least 5)

- [ ] **Step 3: Verify config.ts still works (no changes needed)**

The `CONTRACT_ADDRESS` and `CONTRACT_ABI` exports in `frontend/src/contracts/config.ts` do not need changes — they re-export from `BloodPoints.json` dynamically.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/contracts/BloodPoints.json
git commit -m "chore: regenerate ABI with blood tracking functions"
```

---

## Task 6: Update BloodDonation.tsx for new donateBlood signature

**Files:**
- Modify: `frontend/src/components/BloodDonation.tsx`

- [ ] **Step 1: Replace the entire component with the updated version**

```tsx
import { useState } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { CONTRACT_ABI, CONTRACT_ADDRESS } from '../contracts/config';

const BLOOD_TYPES = ['A', 'B', 'AB', 'O'] as const;
const VOLUMES = [200, 300, 400] as const;

export default function BloodDonation() {
  const { address, isConnected } = useAccount();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const [bloodType, setBloodType] = useState<string>('A');
  const [volume, setVolume] = useState<number>(300);

  const { data: points, refetch: refetchPoints } = useReadContract({
    abi: CONTRACT_ABI.abi,
    address: CONTRACT_ADDRESS,
    functionName: 'getPoints',
    args: [address],
    query: {
      enabled: !!address,
    },
  });

  const donationReceipt = useWaitForTransactionReceipt({
    hash,
  });

  const handleDonate = async () => {
    try {
      await writeContract({
        abi: CONTRACT_ABI.abi,
        address: CONTRACT_ADDRESS,
        functionName: 'donateBlood',
        args: [bloodType, BigInt(volume)],
      });
    } catch (err) {
      console.error('Donation failed:', err);
    }
  };

  // 交易成功后刷新积分
  if (donationReceipt.isSuccess) {
    refetchPoints();
  }

  return (
    <div className="blood-donation-card">
      <div className="card-header">
        <div className="card-icon">🩸</div>
        <h2 className="card-title">献血获取积分</h2>
      </div>

      <div className="card-content">
        <div className="points-display">
          <div className="points-label">当前积分</div>
          <div className="points-value">
            <span className="points-number">{points ? points.toString() : '0'}</span>
            <span className="points-unit">分</span>
          </div>
        </div>

        <div className="donation-form">
          <div className="form-row">
            <label className="form-label">血型</label>
            <div className="blood-type-selector">
              {BLOOD_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  className={`type-btn ${bloodType === type ? 'active' : ''}`}
                  onClick={() => setBloodType(type)}
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
                >
                  {v}ml
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          className="donate-btn"
          onClick={handleDonate}
          disabled={!isConnected || isPending}
        >
          {isPending ? (
            <>
              <span className="btn-spinner"></span>
              处理中...
            </>
          ) : (
            <>
              <span className="btn-icon">❤️</span>
              献血获取 100 积分
            </>
          )}
        </button>

        {error && (
          <div className="error">
            <span className="error-icon">⚠️</span>
            错误: {error.message}
          </div>
        )}

        {donationReceipt.isSuccess && (
          <div className="tx-success">
            <span className="tx-icon">✅</span>
            献血成功！已获得 100 积分，血液记录已上链
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/BloodDonation.tsx
git commit -m "feat(frontend): update BloodDonation for new donateBlood signature with blood type and volume"
```

---

## Task 7: Create BloodTracking.tsx component

**Files:**
- Create: `frontend/src/components/BloodTracking.tsx`

- [ ] **Step 1: Create the BloodTracking component**

```tsx
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

  const steps = ['创建献血记录', '血站接收', '血液检测', '分配病人'];

  const handleSimulate = async () => {
    setSimulating(true);
    setStep(0);

    try {
      // Step 1: Donate blood
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

  // Watch for transaction receipts and advance steps
  const advanceStep = async () => {
    if (!receipt.isSuccess || !simulating) return;

    const banks = bloodBanks.split(',').map(b => b.trim()).filter(b => b.length > 0);

    if (step === 0) {
      // After donateBlood, get the bloodId and start receiving
      const nextId = currentBloodId ?? 0n;
      setCurrentBloodId(nextId);
      setStep(1);
      try {
        await writeContract({
          abi: CONTRACT_ABI.abi,
          address: CONTRACT_ADDRESS,
          functionName: 'receiveBlood',
          args: [nextId, banks[0] || '血站A'],
        });
      } catch (err) {
        console.error('Receive failed:', err);
        setSimulating(false);
      }
    } else if (step === 1 && currentBloodId !== null) {
      if (banks.length > 1) {
        // Transfer through remaining blood banks
        setStep(1);
        try {
          await writeContract({
            abi: CONTRACT_ABI.abi,
            address: CONTRACT_ADDRESS,
            functionName: 'receiveBlood',
            args: [currentBloodId, banks[1]],
          });
          // Remove first bank so next iteration uses remaining
          setBloodBanks(banks.slice(1).join(','));
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
    // Use setTimeout to avoid setState during render
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
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/BloodTracking.tsx
git commit -m "feat(frontend): add BloodTracking component with timeline and simulation"
```

---

## Task 8: Update App.tsx and WalletConnect.tsx for blood tracking navigation

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/WalletConnect.tsx`

- [ ] **Step 1: Update WalletConnect.tsx to add navigation links**

```tsx
import { ConnectButton } from '@rainbow-me/rainbowkit';

interface WalletConnectProps {
  activeSection: string;
  onNavigate: (section: string) => void;
}

export default function WalletConnect({ activeSection, onNavigate }: WalletConnectProps) {
  return (
    <div className="wallet-connect">
      <div className="nav-header">
        <div className="nav-logo">
          <span className="logo-icon">🩸</span>
          <span className="logo-text">BloodPoints</span>
        </div>
        <nav className="nav-links">
          <button
            className={`nav-link ${activeSection === 'home' ? 'active' : ''}`}
            onClick={() => onNavigate('home')}
          >
            首页
          </button>
          <button
            className={`nav-link ${activeSection === 'tracking' ? 'active' : ''}`}
            onClick={() => onNavigate('tracking')}
          >
            血液追踪
          </button>
        </nav>
      </div>
      <div className="connect-wrapper">
        <ConnectButton />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update App.tsx to add section routing and BloodTracking component**

```tsx
import { useState } from 'react';
import { useAccount } from 'wagmi';
import WalletConnect from './components/WalletConnect';
import BloodDonation from './components/BloodDonation';
import Leaderboard from './components/Leaderboard';
import TransferPoints from './components/TransferPoints';
import ProductRedemption from './components/ProductRedemption';
import BloodTracking from './components/BloodTracking';

function App() {
  const { address, isConnected } = useAccount();
  const [activeSection, setActiveSection] = useState('home');

  const shortAddress = (addr: string | undefined) => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <div className="app">
      <WalletConnect activeSection={activeSection} onNavigate={setActiveSection} />

      <header className="app-header">
        <h1>献血积分系统</h1>
        <p>基于区块链的献血积分管理平台</p>
        {isConnected && (
          <div className="wallet-status">
            <span className="status-dot"></span>
            <span className="status-text">已连接: {shortAddress(address)}</span>
          </div>
        )}
      </header>

      <main className="app-main">
        {isConnected ? (
          activeSection === 'tracking' ? (
            <BloodTracking />
          ) : (
            <>
              <section className="blood-donation-card">
                <BloodDonation />
              </section>

              <section className="leaderboard-card">
                <Leaderboard />
              </section>

              <section className="transfer-card">
                <TransferPoints />
              </section>

              <section className="product-redemption-card">
                <ProductRedemption />
              </section>
            </>
          )
        ) : (
          <section className="welcome-section">
            <div className="welcome-content">
              <div className="welcome-icon">🩸</div>
              <h2>欢迎使用献血积分系统</h2>
              <p>连接钱包开始使用区块链献血积分管理功能</p>
              <div className="features-grid">
                <div className="feature-card">
                  <div className="feature-icon">💉</div>
                  <h3>献血积分</h3>
                  <p>献血获得积分奖励</p>
                </div>
                <div className="feature-card">
                  <div className="feature-icon">💝</div>
                  <h3>积分转赠</h3>
                  <p>与其他用户分享积分</p>
                </div>
                <div className="feature-card">
                  <div className="feature-icon">🎁</div>
                  <h3>商品兑换</h3>
                  <p>使用积分兑换商品</p>
                </div>
                <div className="feature-card">
                  <div className="feature-icon">🏆</div>
                  <h3>排行榜</h3>
                  <p>查看积分排行榜</p>
                </div>
                <div className="feature-card">
                  <div className="feature-icon">🩸</div>
                  <h3>血液追踪</h3>
                  <p>追踪血液从献血到病人的完整流转</p>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>

      <footer className="app-footer">
        <p>献血积分系统 &copy; 2026 | 基于区块链技术</p>
      </footer>
    </div>
  );
}

export default App;
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/WalletConnect.tsx frontend/src/App.tsx
git commit -m "feat(frontend): add blood tracking navigation and section routing"
```

---

## Task 9: Add CSS styles for blood tracking

**Files:**
- Modify: `frontend/src/index.css`

- [ ] **Step 1: Append the blood tracking styles to the end of index.css**

Add these styles at the end of `frontend/src/index.css`:

```css
/* ============================================
   血液追踪样式
   ============================================ */

/* Navigation */
.nav-links {
  display: flex;
  gap: 8px;
}

.nav-link {
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 500;
  padding: 8px 16px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.2s;
}

.nav-link:hover {
  color: var(--red-600);
  background: var(--red-50);
}

.nav-link.active {
  color: var(--red-600);
  background: var(--red-50);
  font-weight: 600;
}

/* Section header */
.blood-tracking-section {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.section-title {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.section-desc {
  color: var(--text-secondary);
  font-size: 14px;
  margin: 0;
  flex: 1;
}

.refresh-btn {
  background: var(--bg-card);
  border: 1px solid var(--red-200);
  color: var(--red-600);
  padding: 6px 16px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.refresh-btn:hover {
  background: var(--red-50);
  border-color: var(--red-300);
}

/* Blood cards */
.blood-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 32px;
}

.blood-card {
  background: var(--bg-card);
  border: 1px solid var(--red-100);
  border-radius: var(--radius-md);
  padding: 16px 20px;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: var(--shadow-sm);
}

.blood-card:hover {
  border-color: var(--red-300);
  box-shadow: var(--shadow-md);
}

.blood-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.blood-card-info {
  display: flex;
  gap: 12px;
  align-items: center;
}

.blood-id {
  font-weight: 700;
  color: var(--text-primary);
  font-size: 16px;
}

.blood-type {
  background: var(--red-50);
  color: var(--red-700);
  padding: 2px 10px;
  border-radius: var(--radius-full);
  font-size: 13px;
  font-weight: 500;
}

.blood-volume {
  color: var(--text-secondary);
  font-size: 14px;
}

/* Status badges */
.status-badge {
  padding: 4px 12px;
  border-radius: var(--radius-full);
  font-size: 12px;
  font-weight: 600;
}

.status-donated {
  background: #DBEAFE;
  color: #1D4ED8;
}

.status-received {
  background: #FEF3C7;
  color: #92400E;
}

.status-tested {
  background: #D1FAE5;
  color: #065F46;
}

.status-assigned {
  background: var(--red-100);
  color: var(--red-800);
}

/* Timeline */
.blood-timeline {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid var(--red-100);
}

.timeline-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 16px;
}

.timeline-nodes {
  display: flex;
  align-items: flex-start;
  gap: 0;
  overflow-x: auto;
  padding-bottom: 8px;
}

.timeline-node {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.timeline-node .node-connector {
  color: var(--red-300);
  font-size: 20px;
  margin: 0 4px;
}

.timeline-node .node-icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--red-50);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  border: 2px solid var(--red-200);
}

.timeline-node.active .node-icon {
  background: var(--red-100);
  border-color: var(--red-400);
}

.timeline-node.current .node-icon {
  background: var(--red-500);
  border-color: var(--red-600);
  animation: pulse 2s infinite;
}

.node-content {
  min-width: 100px;
}

.node-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.node-value {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 2px;
}

.node-time {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 2px;
}

@keyframes pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.4); }
  50% { box-shadow: 0 0 0 8px rgba(220, 38, 38, 0); }
}

/* Empty state */
.empty-state {
  text-align: center;
  padding: 48px 20px;
  color: var(--text-secondary);
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 12px;
}

.empty-hint {
  font-size: 13px;
  color: var(--text-muted);
  margin-top: 4px;
}

/* Simulation panel */
.simulation-panel {
  background: var(--bg-card);
  border: 1px solid var(--red-100);
  border-radius: var(--radius-lg);
  padding: 24px;
  box-shadow: var(--shadow-sm);
}

.sim-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 4px 0;
}

.sim-desc {
  color: var(--text-secondary);
  font-size: 14px;
  margin: 0 0 20px 0;
}

.sim-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 20px;
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.form-input {
  background: var(--bg-primary);
  border: 1px solid var(--red-200);
  border-radius: var(--radius-sm);
  padding: 10px 14px;
  font-size: 14px;
  color: var(--text-primary);
  outline: none;
  transition: border-color 0.2s;
}

.form-input:focus {
  border-color: var(--red-400);
}

.form-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.blood-type-selector,
.volume-selector {
  display: flex;
  gap: 8px;
}

.type-btn,
.volume-btn {
  background: var(--bg-primary);
  border: 1px solid var(--red-200);
  border-radius: var(--radius-sm);
  padding: 8px 16px;
  font-size: 14px;
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.2s;
}

.type-btn:hover,
.volume-btn:hover {
  border-color: var(--red-400);
  background: var(--red-50);
}

.type-btn.active,
.volume-btn.active {
  background: var(--red-600);
  color: white;
  border-color: var(--red-600);
}

.type-btn:disabled,
.volume-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Simulation progress */
.sim-progress {
  display: flex;
  justify-content: space-between;
  margin-bottom: 20px;
  position: relative;
}

.sim-progress::before {
  content: '';
  position: absolute;
  top: 20px;
  left: 40px;
  right: 40px;
  height: 2px;
  background: var(--red-100);
}

.progress-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  position: relative;
  z-index: 1;
}

.step-number {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--bg-card);
  border: 2px solid var(--red-200);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 14px;
  color: var(--text-secondary);
  transition: all 0.3s;
}

.progress-step.done .step-number {
  background: var(--red-600);
  border-color: var(--red-600);
  color: white;
}

.progress-step.active .step-number {
  background: var(--bg-card);
  border-color: var(--red-600);
  color: var(--red-600);
  animation: pulse 2s infinite;
}

.step-label {
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
}

.progress-step.done .step-label {
  color: var(--red-600);
  font-weight: 600;
}

.progress-step.active .step-label {
  color: var(--red-600);
  font-weight: 600;
}

.sim-btn {
  width: 100%;
  background: var(--gradient-blood);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  padding: 14px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: var(--shadow-red);
}

.sim-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: var(--shadow-red-lg);
}

.sim-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

/* Donation form (updated BloodDonation) */
.donation-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-bottom: 16px;
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/index.css
git commit -m "feat(frontend): add blood tracking styles for timeline and simulation"
```

---

## Task 10: Build and verify frontend compiles

**Files:**
- None (verification only)

- [ ] **Step 1: Install dependencies if needed**

Run: `cd frontend && npm install`
Expected: No errors

- [ ] **Step 2: Build the frontend**

Run: `cd frontend && npm run build`
Expected: Build succeeds with no TypeScript errors

- [ ] **Step 3: Run lint**

Run: `cd frontend && npm run lint`
Expected: No errors (warnings are acceptable)

- [ ] **Step 4: Commit any fixes if needed**

If the build or lint revealed issues, fix them and commit:

```bash
git add -A
git commit -m "fix: resolve build issues in blood tracking feature"
```

---

## Task 11: Run all contract tests and verify

**Files:**
- None (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npx hardhat test`
Expected: All tests pass

- [ ] **Step 2: Run Solidity tests if any exist**

Run: `npx hardhat test solidity`
Expected: All Solidity tests pass

- [ ] **Step 3: Final commit with all changes**

```bash
git add -A
git commit -m "feat: complete blood tracking feature with tests and frontend"
```
