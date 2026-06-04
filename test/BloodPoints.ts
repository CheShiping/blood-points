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
      const [, , patient] = await viem.getWalletClients();

      await contract.write.donateBlood(["A", 300]);
      await contract.write.receiveBlood([0n, "血站A"]);
      await contract.write.testBlood([0n, true]);
      await contract.write.assignToPatient([0n, patient.account.address]);

      const unit = await contract.read.getBloodUnit([0n]);
      assert.equal(unit.status, 3); // Assigned
      assert.equal(unit.testedPassed, true);
      assert.equal(unit.patient.toLowerCase(), patient.account.address.toLowerCase());
    });

    it("Should complete multi blood bank flow", async function () {
      const contract = await viem.deployContract("BloodPoints", [(await viem.getWalletClients())[0].account.address]);
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
      const contract = await viem.deployContract("BloodPoints", [(await viem.getWalletClients())[0].account.address]);
      const [donor] = await viem.getWalletClients();

      await contract.write.donateBlood(["AB", 200]);
      await contract.write.receiveBlood([0n, "血站A"]);

      const [unit, transfers] = await contract.read.getBloodJourney([0n]);
      assert.equal(unit.bloodId, 0n);
      assert.equal(unit.donor.toLowerCase(), donor.account.address.toLowerCase());
      assert.equal(transfers.length, 1);
      assert.equal(transfers[0].bloodBank, "血站A");
    });

    it("Should track patient blood IDs", async function () {
      const contract = await viem.deployContract("BloodPoints", [(await viem.getWalletClients())[0].account.address]);
      const [, , patient] = await viem.getWalletClients();

      await contract.write.donateBlood(["A", 300]);
      await contract.write.receiveBlood([0n, "血站A"]);
      await contract.write.testBlood([0n, true]);
      await contract.write.assignToPatient([0n, patient.account.address]);

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

      await contract.write.donateBlood(["A", 300]);
      await assert.rejects(
        contract.write.testBlood([0n, true]),
        /Blood must be received before testing/
      );
    });

    it("Should reject assignToPatient on Received blood", async function () {
      const contract = await viem.deployContract("BloodPoints", [(await viem.getWalletClients())[0].account.address]);
      const [, , patient] = await viem.getWalletClients();

      await contract.write.donateBlood(["A", 300]);
      await contract.write.receiveBlood([0n, "血站A"]);
      await assert.rejects(
        contract.write.assignToPatient([0n, patient.account.address]),
        /Blood must be tested before assignment/
      );
    });

    it("Should reject assignToPatient when test failed", async function () {
      const contract = await viem.deployContract("BloodPoints", [(await viem.getWalletClients())[0].account.address]);
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
      const contract = await viem.deployContract("BloodPoints", [(await viem.getWalletClients())[0].account.address]);

      await contract.write.donateBlood(["A", 300]);
      await contract.write.receiveBlood([0n, "血站A"]);
      await contract.write.testBlood([0n, true]);
      await assert.rejects(
        contract.write.receiveBlood([0n, "血站B"]),
        /Blood cannot be received in current status/
      );
    });

    it("Should reject receiveBlood on Assigned blood", async function () {
      const contract = await viem.deployContract("BloodPoints", [(await viem.getWalletClients())[0].account.address]);
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
      const contract = await viem.deployContract("BloodPoints", [(await viem.getWalletClients())[0].account.address]);
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
      const contract = await viem.deployContract("BloodPoints", [(await viem.getWalletClients())[0].account.address]);

      await assert.rejects(
        contract.write.getBloodUnit([999n]),
        /Blood unit does not exist/
      );
    });
  });

  // ==================== 权限控制测试 ====================

  describe("Access Control", async function () {
    it("Should reject receiveBlood from non-owner", async function () {
      const contract = await viem.deployContract("BloodPoints", [(await viem.getWalletClients())[0].account.address]);
      const [, nonOwner] = await viem.getWalletClients();

      await contract.write.donateBlood(["A", 300]);
      await assert.rejects(
        contract.write.receiveBlood([0n, "血站A"], { account: nonOwner.account }),
        /OwnableUnauthorizedAccount/
      );
    });

    it("Should reject testBlood from non-owner", async function () {
      const contract = await viem.deployContract("BloodPoints", [(await viem.getWalletClients())[0].account.address]);
      const [, nonOwner] = await viem.getWalletClients();

      await contract.write.donateBlood(["A", 300]);
      await contract.write.receiveBlood([0n, "血站A"]);
      await assert.rejects(
        contract.write.testBlood([0n, true], { account: nonOwner.account }),
        /OwnableUnauthorizedAccount/
      );
    });

    it("Should reject assignToPatient from non-owner", async function () {
      const contract = await viem.deployContract("BloodPoints", [(await viem.getWalletClients())[0].account.address]);
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
