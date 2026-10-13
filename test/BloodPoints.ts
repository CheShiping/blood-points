import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { network } from "hardhat";
import { keccak256, toBytes } from "viem";

// 与 contracts/BloodPoints.sol 中的角色常量保持一致
const COLLECTOR_ROLE = keccak256(toBytes("COLLECTOR_ROLE"));
const BLOOD_BANK_ROLE = keccak256(toBytes("BLOOD_BANK_ROLE"));
const LAB_ROLE = keccak256(toBytes("LAB_ROLE"));
const HOSPITAL_ROLE = keccak256(toBytes("HOSPITAL_ROLE"));

// 示例 IPFS 凭证 CID（教学模拟）
const EVIDENCE = "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG";

describe("BloodPoints", async function () {
  const { viem } = await network.create();
  const publicClient = await viem.getPublicClient();

  // 每个测试部署全新的 代币 + 平台，并分配好全部业务角色
  async function deployFixture() {
    const wallets = await viem.getWalletClients();
    const [admin, collector, bloodBank, lab, hospital, donor, patient, stranger] = wallets;

    const token = await viem.deployContract("BloodPointToken", [
      admin.account.address,
      admin.account.address,
    ]);
    const bloodPoints = await viem.deployContract("BloodPoints", [
      admin.account.address,
      token.address,
    ]);
    await token.write.setMinter([bloodPoints.address]);

    await bloodPoints.write.grantRole([COLLECTOR_ROLE, collector.account.address]);
    await bloodPoints.write.grantRole([BLOOD_BANK_ROLE, bloodBank.account.address]);
    await bloodPoints.write.grantRole([LAB_ROLE, lab.account.address]);
    await bloodPoints.write.grantRole([HOSPITAL_ROLE, hospital.account.address]);

    return { token, bloodPoints, admin, collector, bloodBank, lab, hospital, donor, patient, stranger };
  }

  // ==================== ERC20 积分功能测试 ====================

  describe("Points System (ERC20)", async function () {
    it("Should award 100 points per donation", async function () {
      const { bloodPoints, donor } = await deployFixture();
      await bloodPoints.write.donateBlood(["A", 300], { account: donor.account });
      assert.equal(
        await bloodPoints.read.getPoints([donor.account.address]),
        100n
      );
    });

    it("Should accumulate points across multiple donations", async function () {
      const { bloodPoints, donor } = await deployFixture();
      await bloodPoints.write.donateBlood(["A", 300], { account: donor.account });
      await bloodPoints.write.donateBlood(["B", 200], { account: donor.account });
      assert.equal(
        await bloodPoints.read.getPoints([donor.account.address]),
        200n
      );
    });

    it("Should award points to donor when collector records blood", async function () {
      const { bloodPoints, collector, donor } = await deployFixture();
      await bloodPoints.write.recordBlood(
        [donor.account.address, "O", 400, EVIDENCE],
        { account: collector.account }
      );
      assert.equal(
        await bloodPoints.read.getPoints([donor.account.address]),
        100n
      );
    });

    it("Should track first-time donors in leaderboard", async function () {
      const { bloodPoints, donor } = await deployFixture();
      await bloodPoints.write.donateBlood(["A", 300], { account: donor.account });
      assert.equal(await bloodPoints.read.getDonorCount(), 1n);
      assert.equal(await bloodPoints.read.isDonor([donor.account.address]), true);
    });

    it("Should not duplicate donors on second donation", async function () {
      const { bloodPoints, donor } = await deployFixture();
      await bloodPoints.write.donateBlood(["A", 300], { account: donor.account });
      await bloodPoints.write.donateBlood(["B", 200], { account: donor.account });
      assert.equal(await bloodPoints.read.getDonorCount(), 1n);
    });

    it("Should return leaderboard sorted by points descending", async function () {
      const { bloodPoints, donor, patient, stranger } = await deployFixture();
      // donor 献 2 次 = 200，stranger 献 1 次 = 100，patient 未献血
      await bloodPoints.write.donateBlood(["A", 300], { account: donor.account });
      await bloodPoints.write.donateBlood(["B", 200], { account: donor.account });
      await bloodPoints.write.donateBlood(["O", 400], { account: stranger.account });

      const [donors, points] = await bloodPoints.read.getLeaderboard();
      assert.equal(donors.length, 2);
      assert.equal(donors[0].toLowerCase(), donor.account.address.toLowerCase());
      assert.equal(points[0], 200n);
      assert.equal(points[1], 100n);
    });

    it("Should burn points when redeeming a product", async function () {
      const { bloodPoints, donor } = await deployFixture();
      await bloodPoints.write.donateBlood(["A", 300], { account: donor.account });
      await bloodPoints.write.addNewProduct(["爱心礼盒", 60, 10]);
      await bloodPoints.write.redeemProduct([0n], { account: donor.account });
      assert.equal(
        await bloodPoints.read.getPoints([donor.account.address]),
        40n
      );
    });
  });

  // ==================== 血液追踪测试 ====================

  describe("Blood Tracking", async function () {
    it("Should create blood unit on donation", async function () {
      const { bloodPoints, donor } = await deployFixture();
      await bloodPoints.write.donateBlood(["A", 300], { account: donor.account });

      const unit = await bloodPoints.read.getBloodUnit([0n]);
      assert.equal(unit.bloodId, 0n);
      assert.equal(unit.donor.toLowerCase(), donor.account.address.toLowerCase());
      assert.equal(unit.volume, 300n);
      assert.equal(unit.bloodType, "A");
      assert.equal(unit.status, 0); // Donated
      assert.equal(unit.testedPassed, false);
    });

    it("Should track donor blood IDs", async function () {
      const { bloodPoints, donor } = await deployFixture();
      await bloodPoints.write.donateBlood(["A", 300], { account: donor.account });
      await bloodPoints.write.donateBlood(["B", 200], { account: donor.account });

      const bloodIds = await bloodPoints.read.getDonorBloods([donor.account.address]);
      assert.deepEqual(bloodIds, [0n, 1n]);
    });

    it("Should complete full journey with role-separated staff", async function () {
      const { bloodPoints, bloodBank, lab, hospital, donor, patient } = await deployFixture();

      await bloodPoints.write.donateBlood(["A", 300], { account: donor.account });
      await bloodPoints.write.receiveBlood([0n, "血站A", EVIDENCE], { account: bloodBank.account });
      await bloodPoints.write.testBlood([0n, true, EVIDENCE], { account: lab.account });
      await bloodPoints.write.assignToPatient([0n, patient.account.address, EVIDENCE], {
        account: hospital.account,
      });

      const unit = await bloodPoints.read.getBloodUnit([0n]);
      assert.equal(unit.status, 3); // Assigned
      assert.equal(unit.testedPassed, true);
      assert.equal(unit.patient.toLowerCase(), patient.account.address.toLowerCase());

      const patientBloods = await bloodPoints.read.getPatientBloods([patient.account.address]);
      assert.deepEqual(patientBloods, [0n]);
    });

    it("Should record milestones with operator, location and IPFS evidence", async function () {
      const { bloodPoints, collector, bloodBank, lab, hospital, donor, patient } =
        await deployFixture();

      await bloodPoints.write.recordBlood(
        [donor.account.address, "A", 300, EVIDENCE],
        { account: collector.account }
      );
      await bloodPoints.write.receiveBlood([0n, "成都市血液中心", "QmReceive"], {
        account: bloodBank.account,
      });
      await bloodPoints.write.testBlood([0n, true, "QmTest"], { account: lab.account });
      await bloodPoints.write.assignToPatient([0n, patient.account.address, "QmAssign"], {
        account: hospital.account,
      });

      const milestones = await bloodPoints.read.getMilestones([0n]);
      assert.equal(milestones.length, 4);

      assert.equal(milestones[0].stage, 0); // Donated
      assert.equal(milestones[0].operator.toLowerCase(), collector.account.address.toLowerCase());
      assert.equal(milestones[0].evidence, EVIDENCE);

      assert.equal(milestones[1].stage, 1); // Received
      assert.equal(milestones[1].location, "成都市血液中心");
      assert.equal(milestones[1].evidence, "QmReceive");
      assert.equal(milestones[1].operator.toLowerCase(), bloodBank.account.address.toLowerCase());

      assert.equal(milestones[2].stage, 2); // Tested
      assert.equal(milestones[2].evidence, "QmTest");
      assert.equal(milestones[2].operator.toLowerCase(), lab.account.address.toLowerCase());

      assert.equal(milestones[3].stage, 3); // Assigned
      assert.equal(milestones[3].evidence, "QmAssign");
      assert.equal(milestones[3].operator.toLowerCase(), hospital.account.address.toLowerCase());
    });

    it("Should return full blood journey (unit + milestones)", async function () {
      const { bloodPoints, bloodBank, donor } = await deployFixture();

      await bloodPoints.write.donateBlood(["AB", 200], { account: donor.account });
      await bloodPoints.write.receiveBlood([0n, "血站A", EVIDENCE], { account: bloodBank.account });

      const [unit, milestones] = await bloodPoints.read.getBloodJourney([0n]);
      assert.equal(unit.bloodId, 0n);
      assert.equal(unit.donor.toLowerCase(), donor.account.address.toLowerCase());
      assert.equal(milestones.length, 2);
      assert.equal(milestones[1].location, "血站A");
    });

    it("Should emit BloodCreated event on donation", async function () {
      const { bloodPoints, donor } = await deployFixture();
      await viem.assertions.emitWithArgs(
        bloodPoints.write.donateBlood(["A", 300], { account: donor.account }),
        bloodPoints,
        "BloodCreated",
        [0n, donor.account.address, "A", 300n]
      );
    });

    it("Should emit MilestoneRecorded event with evidence on receive", async function () {
      const { bloodPoints, bloodBank, donor } = await deployFixture();
      await bloodPoints.write.donateBlood(["A", 300], { account: donor.account });

      await viem.assertions.emitWithArgs(
        bloodPoints.write.receiveBlood([0n, "血站A", "QmEvidence"], { account: bloodBank.account }),
        bloodPoints,
        "MilestoneRecorded",
        [0n, 1, bloodBank.account.address, "血站A", "QmEvidence"]
      );
    });
  });

  // ==================== 状态机校验测试（异常场景） ====================

  describe("State Machine Validation", async function () {
    it("Should reject testBlood on Donated blood", async function () {
      const { bloodPoints, lab, donor } = await deployFixture();
      await bloodPoints.write.donateBlood(["A", 300], { account: donor.account });
      await assert.rejects(
        bloodPoints.write.testBlood([0n, true, EVIDENCE], { account: lab.account }),
        /Blood must be received before testing/
      );
    });

    it("Should reject assignToPatient on Received blood", async function () {
      const { bloodPoints, bloodBank, hospital, donor, patient } = await deployFixture();
      await bloodPoints.write.donateBlood(["A", 300], { account: donor.account });
      await bloodPoints.write.receiveBlood([0n, "血站A", EVIDENCE], { account: bloodBank.account });
      await assert.rejects(
        bloodPoints.write.assignToPatient([0n, patient.account.address, EVIDENCE], {
          account: hospital.account,
        }),
        /Blood must be tested before assignment/
      );
    });

    it("Should reject assignToPatient when test failed", async function () {
      const { bloodPoints, bloodBank, lab, hospital, donor, patient } = await deployFixture();
      await bloodPoints.write.donateBlood(["A", 300], { account: donor.account });
      await bloodPoints.write.receiveBlood([0n, "血站A", EVIDENCE], { account: bloodBank.account });
      await bloodPoints.write.testBlood([0n, false, EVIDENCE], { account: lab.account });
      await assert.rejects(
        bloodPoints.write.assignToPatient([0n, patient.account.address, EVIDENCE], {
          account: hospital.account,
        }),
        /Blood test must pass before assignment/
      );
    });

    it("Should reject receiveBlood on Tested blood", async function () {
      const { bloodPoints, bloodBank, lab, donor } = await deployFixture();
      await bloodPoints.write.donateBlood(["A", 300], { account: donor.account });
      await bloodPoints.write.receiveBlood([0n, "血站A", EVIDENCE], { account: bloodBank.account });
      await bloodPoints.write.testBlood([0n, true, EVIDENCE], { account: lab.account });
      await assert.rejects(
        bloodPoints.write.receiveBlood([0n, "血站B", EVIDENCE], { account: bloodBank.account }),
        /Blood cannot be received in current status/
      );
    });

    it("Should reject receiveBlood on Assigned blood", async function () {
      const { bloodPoints, bloodBank, lab, hospital, donor, patient } = await deployFixture();
      await bloodPoints.write.donateBlood(["A", 300], { account: donor.account });
      await bloodPoints.write.receiveBlood([0n, "血站A", EVIDENCE], { account: bloodBank.account });
      await bloodPoints.write.testBlood([0n, true, EVIDENCE], { account: lab.account });
      await bloodPoints.write.assignToPatient([0n, patient.account.address, EVIDENCE], {
        account: hospital.account,
      });
      await assert.rejects(
        bloodPoints.write.receiveBlood([0n, "血站B", EVIDENCE], { account: bloodBank.account }),
        /Blood cannot be received in current status/
      );
    });

    it("Should reject duplicate assignment", async function () {
      const { bloodPoints, bloodBank, lab, hospital, donor, patient } = await deployFixture();
      await bloodPoints.write.donateBlood(["A", 300], { account: donor.account });
      await bloodPoints.write.receiveBlood([0n, "血站A", EVIDENCE], { account: bloodBank.account });
      await bloodPoints.write.testBlood([0n, true, EVIDENCE], { account: lab.account });
      await bloodPoints.write.assignToPatient([0n, patient.account.address, EVIDENCE], {
        account: hospital.account,
      });
      await assert.rejects(
        bloodPoints.write.assignToPatient([0n, patient.account.address, EVIDENCE], {
          account: hospital.account,
        }),
        /Blood must be tested before assignment/
      );
    });

    it("Should reject operations on non-existent bloodId", async function () {
      const { bloodPoints, bloodBank } = await deployFixture();
      await assert.rejects(
        bloodPoints.write.receiveBlood([999n, "血站A", EVIDENCE], { account: bloodBank.account }),
        /Blood unit does not exist/
      );
      await assert.rejects(
        bloodPoints.read.getBloodUnit([999n]),
        /Blood unit does not exist/
      );
    });

    it("Should reject donateBlood with invalid inputs", async function () {
      const { bloodPoints, donor } = await deployFixture();
      await assert.rejects(
        bloodPoints.write.donateBlood(["", 300], { account: donor.account }),
        /Blood type cannot be empty/
      );
      await assert.rejects(
        bloodPoints.write.donateBlood(["A", 0], { account: donor.account }),
        /Volume must be greater than 0/
      );
    });

    it("Should reject recordBlood with invalid donor", async function () {
      const { bloodPoints, collector } = await deployFixture();
      await assert.rejects(
        bloodPoints.write.recordBlood(
          ["0x0000000000000000000000000000000000000000", "A", 300, EVIDENCE],
          { account: collector.account }
        ),
        /Invalid donor address/
      );
    });
  });

  // ==================== 权限控制测试 ====================

  describe("Access Control", async function () {
    it("Should reject receiveBlood without BLOOD_BANK_ROLE", async function () {
      const { bloodPoints, stranger, donor } = await deployFixture();
      await bloodPoints.write.donateBlood(["A", 300], { account: donor.account });
      await assert.rejects(
        bloodPoints.write.receiveBlood([0n, "血站A", EVIDENCE], { account: stranger.account }),
        /AccessControlUnauthorizedAccount/
      );
    });

    it("Should reject testBlood without LAB_ROLE", async function () {
      const { bloodPoints, bloodBank, stranger, donor } = await deployFixture();
      await bloodPoints.write.donateBlood(["A", 300], { account: donor.account });
      await bloodPoints.write.receiveBlood([0n, "血站A", EVIDENCE], { account: bloodBank.account });
      await assert.rejects(
        bloodPoints.write.testBlood([0n, true, EVIDENCE], { account: stranger.account }),
        /AccessControlUnauthorizedAccount/
      );
    });

    it("Should reject assignToPatient without HOSPITAL_ROLE", async function () {
      const { bloodPoints, bloodBank, lab, stranger, donor, patient } = await deployFixture();
      await bloodPoints.write.donateBlood(["A", 300], { account: donor.account });
      await bloodPoints.write.receiveBlood([0n, "血站A", EVIDENCE], { account: bloodBank.account });
      await bloodPoints.write.testBlood([0n, true, EVIDENCE], { account: lab.account });
      await assert.rejects(
        bloodPoints.write.assignToPatient([0n, patient.account.address, EVIDENCE], {
          account: stranger.account,
        }),
        /AccessControlUnauthorizedAccount/
      );
    });

    it("Should reject recordBlood without COLLECTOR_ROLE", async function () {
      const { bloodPoints, stranger, donor } = await deployFixture();
      await assert.rejects(
        bloodPoints.write.recordBlood([donor.account.address, "A", 300, EVIDENCE], {
          account: stranger.account,
        }),
        /AccessControlUnauthorizedAccount/
      );
    });

    it("Should reject addNewProduct from non-admin", async function () {
      const { bloodPoints, stranger } = await deployFixture();
      await assert.rejects(
        bloodPoints.write.addNewProduct(["T恤", 50, 10], { account: stranger.account }),
        /AccessControlUnauthorizedAccount/
      );
    });

    it("Should reject pause from non-admin", async function () {
      const { bloodPoints, stranger } = await deployFixture();
      await assert.rejects(
        bloodPoints.write.pause({ account: stranger.account }),
        /AccessControlUnauthorizedAccount/
      );
    });

    it("Should reject setPointsToken from non-admin and with zero address", async function () {
      const { bloodPoints, stranger } = await deployFixture();
      await assert.rejects(
        bloodPoints.write.setPointsToken([stranger.account.address], { account: stranger.account }),
        /AccessControlUnauthorizedAccount/
      );
      await assert.rejects(
        bloodPoints.write.setPointsToken(["0x0000000000000000000000000000000000000000"]),
        /ZeroAddress/
      );
    });

    it("Should allow admin to grant and revoke roles", async function () {
      const { bloodPoints, admin, stranger, donor } = await deployFixture();

      // 授权后可以登记
      await bloodPoints.write.grantRole([COLLECTOR_ROLE, stranger.account.address]);
      await bloodPoints.write.recordBlood([donor.account.address, "A", 300, EVIDENCE], {
        account: stranger.account,
      });
      assert.equal(
        await bloodPoints.read.getPoints([donor.account.address]),
        100n
      );

      // 撤销后拒绝
      await bloodPoints.write.revokeRole([COLLECTOR_ROLE, stranger.account.address]);
      await assert.rejects(
        bloodPoints.write.recordBlood([donor.account.address, "A", 300, EVIDENCE], {
          account: stranger.account,
        }),
        /AccessControlUnauthorizedAccount/
      );
    });

    it("Should report hasRole correctly", async function () {
      const { bloodPoints, admin, collector } = await deployFixture();
      assert.equal(
        await bloodPoints.read.hasRole([COLLECTOR_ROLE, collector.account.address]),
        true
      );
      assert.equal(
        await bloodPoints.read.hasRole([COLLECTOR_ROLE, admin.account.address]),
        false
      );
    });
  });

  // ==================== 应急暂停测试（安全场景） ====================

  describe("Pausable (Emergency)", async function () {
    it("Should block donateBlood and redeemProduct when paused", async function () {
      const { bloodPoints, donor } = await deployFixture();
      await bloodPoints.write.donateBlood(["A", 300], { account: donor.account });
      await bloodPoints.write.addNewProduct(["T恤", 50, 10]);

      await bloodPoints.write.pause();

      await assert.rejects(
        bloodPoints.write.donateBlood(["A", 300], { account: donor.account }),
        /EnforcedPause/
      );
      await assert.rejects(
        bloodPoints.write.redeemProduct([0n], { account: donor.account }),
        /EnforcedPause/
      );

      // 恢复后可继续
      await bloodPoints.write.unpause();
      await bloodPoints.write.donateBlood(["B", 200], { account: donor.account });
      assert.equal(
        await bloodPoints.read.getPoints([donor.account.address]),
        200n
      );
    });

    it("Should keep blood flow operational when paused (clinical continuity)", async function () {
      const { bloodPoints, bloodBank, lab, hospital, donor, patient } = await deployFixture();
      await bloodPoints.write.donateBlood(["A", 300], { account: donor.account });

      await bloodPoints.write.pause();

      // 血液流转不受暂停影响
      await bloodPoints.write.receiveBlood([0n, "血站A", EVIDENCE], { account: bloodBank.account });
      await bloodPoints.write.testBlood([0n, true, EVIDENCE], { account: lab.account });
      await bloodPoints.write.assignToPatient([0n, patient.account.address, EVIDENCE], {
        account: hospital.account,
      });

      const unit = await bloodPoints.read.getBloodUnit([0n]);
      assert.equal(unit.status, 3); // Assigned
    });
  });

  // ==================== 商品功能测试 ====================

  describe("Product Management", async function () {
    it("Should add and redeem product", async function () {
      const { bloodPoints, donor } = await deployFixture();
      await bloodPoints.write.donateBlood(["A", 300], { account: donor.account });
      await bloodPoints.write.addNewProduct(["T恤", 50, 10]);
      await bloodPoints.write.redeemProduct([0n], { account: donor.account });

      const product = await bloodPoints.read.getProduct([0n]);
      assert.equal(product[2], 50n); // price
      assert.equal(product[3], 9n); // stock
    });

    it("Should reject redeem with insufficient points", async function () {
      const { bloodPoints, donor } = await deployFixture();
      await bloodPoints.write.addNewProduct(["T恤", 200, 10]);
      await assert.rejects(
        bloodPoints.write.redeemProduct([0n], { account: donor.account }),
        /Insufficient points/
      );
    });

    it("Should reject redeem of non-existent product", async function () {
      const { bloodPoints, donor } = await deployFixture();
      await assert.rejects(
        bloodPoints.write.redeemProduct([0n], { account: donor.account }),
        /Product does not exist/
      );
    });

    it("Should reject addNewProduct with invalid inputs", async function () {
      const { bloodPoints } = await deployFixture();
      await assert.rejects(
        bloodPoints.write.addNewProduct(["", 50, 10]),
        /Product name cannot be empty/
      );
      await assert.rejects(
        bloodPoints.write.addNewProduct(["T恤", 0, 10]),
        /Price must be greater than 0/
      );
      await assert.rejects(
        bloodPoints.write.addNewProduct(["T恤", 50, 0]),
        /Stock must be greater than 0/
      );
    });
  });

  // ==================== 查询功能测试 ====================

  describe("Blood Query Functions", async function () {
    it("Should query blood by type", async function () {
      const { bloodPoints, donor } = await deployFixture();
      await bloodPoints.write.donateBlood(["A", 300], { account: donor.account });
      await bloodPoints.write.donateBlood(["B", 200], { account: donor.account });
      await bloodPoints.write.donateBlood(["A", 400], { account: donor.account });

      assert.deepEqual(await bloodPoints.read.getBloodsByType(["A"]), [0n, 2n]);
      assert.deepEqual(await bloodPoints.read.getBloodsByType(["B"]), [1n]);
    });

    it("Should query all blood IDs", async function () {
      const { bloodPoints, donor } = await deployFixture();
      await bloodPoints.write.donateBlood(["A", 300], { account: donor.account });
      await bloodPoints.write.donateBlood(["B", 200], { account: donor.account });
      assert.deepEqual(await bloodPoints.read.getAllBloodIds(), [0n, 1n]);
    });

    it("Should query blood by status", async function () {
      const { bloodPoints, bloodBank, donor } = await deployFixture();
      await bloodPoints.write.donateBlood(["A", 300], { account: donor.account });
      await bloodPoints.write.donateBlood(["B", 200], { account: donor.account });
      await bloodPoints.write.receiveBlood([0n, "血站A", EVIDENCE], { account: bloodBank.account });

      assert.deepEqual(await bloodPoints.read.getBloodsByStatus([0]), [1n]); // Donated
      assert.deepEqual(await bloodPoints.read.getBloodsByStatus([1]), [0n]); // Received
    });
  });
});
