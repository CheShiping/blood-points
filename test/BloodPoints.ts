import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { network } from "hardhat";

describe("BloodPoints", async function () {
  const { viem } = await network.create();
  const publicClient = await viem.getPublicClient();

  // ==================== 积分功能测试 ====================

  describe("Points System", async function () {
    it("Should award 100 points per donation", async function () {
      const contract = await viem.deployContract("BloodPoints", [(await viem.getWalletClients())[0].account.address]);
      const [donor] = await viem.getWalletClients();

      await contract.write.donateBlood(["A", 300]);
      const points = await contract.read.getPoints([donor.account.address]);
      assert.equal(points, 100n);
    });

    it("Should accumulate points across multiple donations", async function () {
      const contract = await viem.deployContract("BloodPoints", [(await viem.getWalletClients())[0].account.address]);
      const [donor] = await viem.getWalletClients();

      await contract.write.donateBlood(["A", 300]);
      await contract.write.donateBlood(["B", 200]);
      const points = await contract.read.getPoints([donor.account.address]);
      assert.equal(points, 200n);
    });

    it("Should track first-time donors in leaderboard", async function () {
      const contract = await viem.deployContract("BloodPoints", [(await viem.getWalletClients())[0].account.address]);
      const [donor] = await viem.getWalletClients();

      await contract.write.donateBlood(["A", 300]);
      const count = await contract.read.getDonorCount();
      assert.equal(count, 1n);

      const isDonorFlag = await contract.read.isDonor([donor.account.address]);
      assert.equal(isDonorFlag, true);
    });

    it("Should not duplicate donors on second donation", async function () {
      const contract = await viem.deployContract("BloodPoints", [(await viem.getWalletClients())[0].account.address]);

      await contract.write.donateBlood(["A", 300]);
      await contract.write.donateBlood(["B", 200]);
      const count = await contract.read.getDonorCount();
      assert.equal(count, 1n);
    });

    it("Should transfer points between users", async function () {
      const contract = await viem.deployContract("BloodPoints", [(await viem.getWalletClients())[0].account.address]);
      const [donor, recipient] = await viem.getWalletClients();

      await contract.write.donateBlood(["A", 300]);
      await contract.write.transferPoints([recipient.account.address, 50]);

      const donorPoints = await contract.read.getPoints([donor.account.address]);
      const recipientPoints = await contract.read.getPoints([recipient.account.address]);
      assert.equal(donorPoints, 50n);
      assert.equal(recipientPoints, 50n);
    });

    it("Should reject transfer to self", async function () {
      const contract = await viem.deployContract("BloodPoints", [(await viem.getWalletClients())[0].account.address]);
      const [donor] = await viem.getWalletClients();

      await contract.write.donateBlood(["A", 300]);
      await assert.rejects(
        contract.write.transferPoints([donor.account.address, 50]),
        /Cannot transfer to yourself/
      );
    });

    it("Should reject transfer with insufficient points", async function () {
      const contract = await viem.deployContract("BloodPoints", [(await viem.getWalletClients())[0].account.address]);
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
      const contract = await viem.deployContract("BloodPoints", [(await viem.getWalletClients())[0].account.address]);
      const [donor] = await viem.getWalletClients();

      await contract.write.donateBlood(["A", 300]);

      const unit = await contract.read.getBloodUnit([0n]);
      assert.equal(unit.bloodId, 0n);
      assert.equal(unit.donor.toLowerCase(), donor.account.address.toLowerCase());
      assert.equal(unit.volume, 300n);
      assert.equal(unit.bloodType, "A");
      assert.equal(unit.status, 0); // Donated
      assert.equal(unit.testedPassed, false);
    });

    it("Should track donor blood IDs", async function () {
      const contract = await viem.deployContract("BloodPoints", [(await viem.getWalletClients())[0].account.address]);
      const [donor] = await viem.getWalletClients();

      await contract.write.donateBlood(["A", 300]);
      await contract.write.donateBlood(["B", 200]);

      const bloodIds = await contract.read.getDonorBloods([donor.account.address]);
      assert.deepEqual(bloodIds, [0n, 1n]);
    });

    it("Should complete single blood bank flow", async function () {
      const contract = await viem.deployContract("BloodPoints", [(await viem.getWalletClients())[0].account.address]);
      const [owner, bloodBank, patient] = await viem.getWalletClients();

      // 给 bloodBank 角色分配 BloodBank 角色
      await contract.write.assignRole([bloodBank.account.address, 2]); // Role.BloodBank = 2

      await contract.write.donateBlood(["A", 300]);
      await contract.write.receiveBlood([0n, "血站A"], { account: bloodBank.account });
      await contract.write.testBlood([0n, true], { account: bloodBank.account });
      await contract.write.assignToPatient([0n, patient.account.address], { account: bloodBank.account });

      const unit = await contract.read.getBloodUnit([0n]);
      assert.equal(unit.status, 3); // Assigned
      assert.equal(unit.testedPassed, true);
      assert.equal(unit.patient.toLowerCase(), patient.account.address.toLowerCase());
    });

    it("Should complete multi blood bank flow", async function () {
      const contract = await viem.deployContract("BloodPoints", [(await viem.getWalletClients())[0].account.address]);
      const [owner, bloodBank, patient] = await viem.getWalletClients();

      await contract.write.assignRole([bloodBank.account.address, 2]); // Role.BloodBank

      await contract.write.donateBlood(["O", 400]);
      await contract.write.receiveBlood([0n, "血站A"], { account: bloodBank.account });
      await contract.write.receiveBlood([0n, "血站B"], { account: bloodBank.account });
      await contract.write.testBlood([0n, true], { account: bloodBank.account });
      await contract.write.assignToPatient([0n, patient.account.address], { account: bloodBank.account });

      const unit = await contract.read.getBloodUnit([0n]);
      assert.equal(unit.status, 3); // Assigned

      const transfers = await contract.read.getBloodTransfers([0n]);
      assert.equal(transfers.length, 2);
      assert.equal(transfers[0].bloodBank, "血站A");
      assert.equal(transfers[1].bloodBank, "血站B");
    });

    it("Should return full blood journey", async function () {
      const contract = await viem.deployContract("BloodPoints", [(await viem.getWalletClients())[0].account.address]);
      const [donor, bloodBank] = await viem.getWalletClients();

      await contract.write.assignRole([bloodBank.account.address, 2]); // Role.BloodBank

      await contract.write.donateBlood(["AB", 200]);
      await contract.write.receiveBlood([0n, "血站A"], { account: bloodBank.account });

      const [unit, transfers] = await contract.read.getBloodJourney([0n]);
      assert.equal(unit.bloodId, 0n);
      assert.equal(unit.donor.toLowerCase(), donor.account.address.toLowerCase());
      assert.equal(transfers.length, 1);
      assert.equal(transfers[0].bloodBank, "血站A");
    });

    it("Should track patient blood IDs", async function () {
      const contract = await viem.deployContract("BloodPoints", [(await viem.getWalletClients())[0].account.address]);
      const [owner, bloodBank, patient] = await viem.getWalletClients();

      await contract.write.assignRole([bloodBank.account.address, 2]); // Role.BloodBank

      await contract.write.donateBlood(["A", 300]);
      await contract.write.receiveBlood([0n, "血站A"], { account: bloodBank.account });
      await contract.write.testBlood([0n, true], { account: bloodBank.account });
      await contract.write.assignToPatient([0n, patient.account.address], { account: bloodBank.account });

      const bloodIds = await contract.read.getPatientBloods([patient.account.address]);
      assert.deepEqual(bloodIds, [0n]);
    });

    it("Should emit BloodCreated event", async function () {
      const contract = await viem.deployContract("BloodPoints", [(await viem.getWalletClients())[0].account.address]);

      await viem.assertions.emitWithArgs(
        contract.write.donateBlood(["A", 300]),
        contract,
        "BloodCreated",
        [0n, (await viem.getWalletClients())[0].account.address, "A", 300n]
      );
    });
  });

  // ==================== 状态校验测试 ====================

  describe("State Machine Validation", async function () {
    it("Should reject testBlood on Donated blood", async function () {
      const contract = await viem.deployContract("BloodPoints", [(await viem.getWalletClients())[0].account.address]);
      const [, bloodBank] = await viem.getWalletClients();

      await contract.write.assignRole([bloodBank.account.address, 2]); // Role.BloodBank

      await contract.write.donateBlood(["A", 300]);
      await assert.rejects(
        contract.write.testBlood([0n, true], { account: bloodBank.account }),
        /Blood must be received before testing/
      );
    });

    it("Should reject assignToPatient on Received blood", async function () {
      const contract = await viem.deployContract("BloodPoints", [(await viem.getWalletClients())[0].account.address]);
      const [, bloodBank, patient] = await viem.getWalletClients();

      await contract.write.assignRole([bloodBank.account.address, 2]); // Role.BloodBank

      await contract.write.donateBlood(["A", 300]);
      await contract.write.receiveBlood([0n, "血站A"], { account: bloodBank.account });
      await assert.rejects(
        contract.write.assignToPatient([0n, patient.account.address], { account: bloodBank.account }),
        /Blood must be tested before assignment/
      );
    });

    it("Should reject assignToPatient when test failed", async function () {
      const contract = await viem.deployContract("BloodPoints", [(await viem.getWalletClients())[0].account.address]);
      const [, bloodBank, patient] = await viem.getWalletClients();

      await contract.write.assignRole([bloodBank.account.address, 2]); // Role.BloodBank

      await contract.write.donateBlood(["A", 300]);
      await contract.write.receiveBlood([0n, "血站A"], { account: bloodBank.account });
      await contract.write.testBlood([0n, false], { account: bloodBank.account });
      await assert.rejects(
        contract.write.assignToPatient([0n, patient.account.address], { account: bloodBank.account }),
        /Blood test must pass before assignment/
      );
    });

    it("Should reject receiveBlood on Tested blood", async function () {
      const contract = await viem.deployContract("BloodPoints", [(await viem.getWalletClients())[0].account.address]);
      const [, bloodBank] = await viem.getWalletClients();

      await contract.write.assignRole([bloodBank.account.address, 2]); // Role.BloodBank

      await contract.write.donateBlood(["A", 300]);
      await contract.write.receiveBlood([0n, "血站A"], { account: bloodBank.account });
      await contract.write.testBlood([0n, true], { account: bloodBank.account });
      await assert.rejects(
        contract.write.receiveBlood([0n, "血站B"], { account: bloodBank.account }),
        /Blood cannot be received in current status/
      );
    });

    it("Should reject receiveBlood on Assigned blood", async function () {
      const contract = await viem.deployContract("BloodPoints", [(await viem.getWalletClients())[0].account.address]);
      const [, bloodBank, patient] = await viem.getWalletClients();

      await contract.write.assignRole([bloodBank.account.address, 2]); // Role.BloodBank

      await contract.write.donateBlood(["A", 300]);
      await contract.write.receiveBlood([0n, "血站A"], { account: bloodBank.account });
      await contract.write.testBlood([0n, true], { account: bloodBank.account });
      await contract.write.assignToPatient([0n, patient.account.address], { account: bloodBank.account });
      await assert.rejects(
        contract.write.receiveBlood([0n, "血站B"], { account: bloodBank.account }),
        /Blood cannot be received in current status/
      );
    });

    it("Should reject duplicate assignment", async function () {
      const contract = await viem.deployContract("BloodPoints", [(await viem.getWalletClients())[0].account.address]);
      const [, bloodBank, patient] = await viem.getWalletClients();

      await contract.write.assignRole([bloodBank.account.address, 2]); // Role.BloodBank

      await contract.write.donateBlood(["A", 300]);
      await contract.write.receiveBlood([0n, "血站A"], { account: bloodBank.account });
      await contract.write.testBlood([0n, true], { account: bloodBank.account });
      await contract.write.assignToPatient([0n, patient.account.address], { account: bloodBank.account });
      await assert.rejects(
        contract.write.assignToPatient([0n, patient.account.address], { account: bloodBank.account }),
        /Blood must be tested before assignment/
      );
    });

    it("Should reject non-existent bloodId", async function () {
      const contract = await viem.deployContract("BloodPoints", [(await viem.getWalletClients())[0].account.address]);

      await assert.rejects(
        contract.write.getBloodUnit([999n]),
        /Blood unit does not exist/
      );
    });
  });

  // ==================== 权限控制测试 ====================

  describe("Access Control", async function () {
    it("Should reject receiveBlood from non-BloodBank role", async function () {
      const contract = await viem.deployContract("BloodPoints", [(await viem.getWalletClients())[0].account.address]);
      const [, noRole] = await viem.getWalletClients();

      await contract.write.donateBlood(["A", 300]);
      await assert.rejects(
        contract.write.receiveBlood([0n, "血站A"], { account: noRole.account }),
        /Caller does not have required role/
      );
    });

    it("Should reject testBlood from non-BloodBank role", async function () {
      const contract = await viem.deployContract("BloodPoints", [(await viem.getWalletClients())[0].account.address]);
      const [, bloodBank, noRole] = await viem.getWalletClients();

      await contract.write.assignRole([bloodBank.account.address, 2]); // Role.BloodBank

      await contract.write.donateBlood(["A", 300]);
      await contract.write.receiveBlood([0n, "血站A"], { account: bloodBank.account });
      await assert.rejects(
        contract.write.testBlood([0n, true], { account: noRole.account }),
        /Caller does not have required role/
      );
    });

    it("Should reject assignToPatient from non-BloodBank role", async function () {
      const contract = await viem.deployContract("BloodPoints", [(await viem.getWalletClients())[0].account.address]);
      const [, bloodBank, noRole] = await viem.getWalletClients();

      await contract.write.assignRole([bloodBank.account.address, 2]); // Role.BloodBank

      await contract.write.donateBlood(["A", 300]);
      await contract.write.receiveBlood([0n, "血站A"], { account: bloodBank.account });
      await contract.write.testBlood([0n, true], { account: bloodBank.account });
      await assert.rejects(
        contract.write.assignToPatient([0n, noRole.account.address], { account: noRole.account }),
        /Caller does not have required role/
      );
    });

    it("Should reject recordBlood from non-Collector role", async function () {
      const contract = await viem.deployContract("BloodPoints", [(await viem.getWalletClients())[0].account.address]);
      const [, noRole, donor] = await viem.getWalletClients();

      await assert.rejects(
        contract.write.recordBlood([donor.account.address, "A", 300], { account: noRole.account }),
        /Caller does not have required role/
      );
    });

    it("Should allow BloodBank role to receive/test/assign", async function () {
      const contract = await viem.deployContract("BloodPoints", [(await viem.getWalletClients())[0].account.address]);
      const [owner, bloodBank, patient] = await viem.getWalletClients();

      await contract.write.assignRole([bloodBank.account.address, 2]); // Role.BloodBank

      await contract.write.donateBlood(["A", 300]);
      await contract.write.receiveBlood([0n, "血站A"], { account: bloodBank.account });
      await contract.write.testBlood([0n, true], { account: bloodBank.account });
      await contract.write.assignToPatient([0n, patient.account.address], { account: bloodBank.account });

      const unit = await contract.read.getBloodUnit([0n]);
      assert.equal(unit.status, 3); // Assigned
    });

    it("Should allow Collector role to record blood", async function () {
      const contract = await viem.deployContract("BloodPoints", [(await viem.getWalletClients())[0].account.address]);
      const [owner, collector, donor] = await viem.getWalletClients();

      await contract.write.assignRole([collector.account.address, 1]); // Role.Collector

      await contract.write.recordBlood([donor.account.address, "A", 300], { account: collector.account });

      const unit = await contract.read.getBloodUnit([0n]);
      assert.equal(unit.donor.toLowerCase(), donor.account.address.toLowerCase());
      assert.equal(unit.bloodType, "A");
      assert.equal(unit.volume, 300n);

      const points = await contract.read.getPoints([donor.account.address]);
      assert.equal(points, 100n);
    });

    it("Should allow owner to assign and revoke roles", async function () {
      const contract = await viem.deployContract("BloodPoints", [(await viem.getWalletClients())[0].account.address]);
      const [owner, user] = await viem.getWalletClients();

      await contract.write.assignRole([user.account.address, 1]); // Role.Collector
      let role = await contract.read.roles([user.account.address]);
      assert.equal(role, 1);

      await contract.write.revokeRole([user.account.address]);
      role = await contract.read.roles([user.account.address]);
      assert.equal(role, 0);
    });
  });

  // ==================== 采集记录员功能测试 ====================

  describe("Collector Functionality", async function () {
    it("Should record blood and award points to donor", async function () {
      const contract = await viem.deployContract("BloodPoints", [(await viem.getWalletClients())[0].account.address]);
      const [owner, collector, donor] = await viem.getWalletClients();

      await contract.write.assignRole([collector.account.address, 1]); // Role.Collector

      await contract.write.recordBlood([donor.account.address, "O", 400], { account: collector.account });

      const unit = await contract.read.getBloodUnit([0n]);
      assert.equal(unit.bloodId, 0n);
      assert.equal(unit.donor.toLowerCase(), donor.account.address.toLowerCase());
      assert.equal(unit.bloodType, "O");
      assert.equal(unit.volume, 400n);
      assert.equal(unit.status, 0); // Donated

      const points = await contract.read.getPoints([donor.account.address]);
      assert.equal(points, 100n);
    });

    it("Should register first-time donor in leaderboard", async function () {
      const contract = await viem.deployContract("BloodPoints", [(await viem.getWalletClients())[0].account.address]);
      const [owner, collector, donor] = await viem.getWalletClients();

      await contract.write.assignRole([collector.account.address, 1]); // Role.Collector

      await contract.write.recordBlood([donor.account.address, "B", 200], { account: collector.account });

      const isDonorFlag = await contract.read.isDonor([donor.account.address]);
      assert.equal(isDonorFlag, true);

      const count = await contract.read.getDonorCount();
      assert.equal(count, 1n);
    });

    it("Should reject recordBlood with invalid donor", async function () {
      const contract = await viem.deployContract("BloodPoints", [(await viem.getWalletClients())[0].account.address]);
      const [owner, collector] = await viem.getWalletClients();

      await contract.write.assignRole([collector.account.address, 1]); // Role.Collector

      await assert.rejects(
        contract.write.recordBlood(["0x0000000000000000000000000000000000000000", "A", 300], { account: collector.account }),
        /Invalid donor address/
      );
    });
  });

  // ==================== 血液查询功能测试 ====================

  describe("Blood Query Functions", async function () {
    it("Should query blood by type", async function () {
      const contract = await viem.deployContract("BloodPoints", [(await viem.getWalletClients())[0].account.address]);

      await contract.write.donateBlood(["A", 300]);
      await contract.write.donateBlood(["B", 200]);
      await contract.write.donateBlood(["A", 400]);

      const aBloods = await contract.read.getBloodsByType(["A"]);
      assert.deepEqual(aBloods, [0n, 2n]);

      const bBloods = await contract.read.getBloodsByType(["B"]);
      assert.deepEqual(bBloods, [1n]);
    });

    it("Should query all blood IDs", async function () {
      const contract = await viem.deployContract("BloodPoints", [(await viem.getWalletClients())[0].account.address]);

      await contract.write.donateBlood(["A", 300]);
      await contract.write.donateBlood(["B", 200]);

      const allIds = await contract.read.getAllBloodIds();
      assert.deepEqual(allIds, [0n, 1n]);
    });

    it("Should query blood by status", async function () {
      const contract = await viem.deployContract("BloodPoints", [(await viem.getWalletClients())[0].account.address]);
      const [owner, bloodBank] = await viem.getWalletClients();

      await contract.write.assignRole([bloodBank.account.address, 2]); // Role.BloodBank

      await contract.write.donateBlood(["A", 300]);
      await contract.write.donateBlood(["B", 200]);
      await contract.write.receiveBlood([0n, "血站A"], { account: bloodBank.account });

      const donatedIds = await contract.read.getBloodsByStatus([0]); // Donated
      assert.deepEqual(donatedIds, [1n]);

      const receivedIds = await contract.read.getBloodsByStatus([1]); // Received
      assert.deepEqual(receivedIds, [0n]);
    });
  });

  // ==================== 商品功能测试 ====================

  describe("Product Management", async function () {
    it("Should add and redeem product", async function () {
      const contract = await viem.deployContract("BloodPoints", [(await viem.getWalletClients())[0].account.address]);

      await contract.write.donateBlood(["A", 300]);
      await contract.write.addNewProduct(["T恤", 50, 10]);
      await contract.write.redeemProduct([0n]);

      const points = await contract.read.getPoints([(await viem.getWalletClients())[0].account.address]);
      assert.equal(points, 50n);

      const [, , , stock] = await contract.read.getProduct([0n]);
      assert.equal(stock, 9n);
    });

    it("Should reject redeem with insufficient points", async function () {
      const contract = await viem.deployContract("BloodPoints", [(await viem.getWalletClients())[0].account.address]);

      await contract.write.addNewProduct(["T恤", 200, 10]);
      await assert.rejects(
        contract.write.redeemProduct([0n]),
        /Insufficient points/
      );
    });
  });
});
