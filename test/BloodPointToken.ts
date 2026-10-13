import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { network } from "hardhat";
import { keccak256, toBytes } from "viem";

describe("BloodPointToken (ERC20)", async function () {
  const { viem } = await network.create();
  const publicClient = await viem.getPublicClient();

  // 每个测试部署一套全新的 代币 + 平台 组合
  async function deployFixture() {
    const [admin, platform, user, other] = await viem.getWalletClients();
    // minter 先设为 admin，部署平台后再切换
    const token = await viem.deployContract("BloodPointToken", [
      admin.account.address,
      admin.account.address,
    ]);
    const bloodPoints = await viem.deployContract("BloodPoints", [
      admin.account.address,
      token.address,
    ]);
    await token.write.setMinter([bloodPoints.address]);
    return { token, bloodPoints, admin, platform, user, other };
  }

  describe("Metadata", async function () {
    it("Should have correct name, symbol and 0 decimals", async function () {
      const { token } = await deployFixture();
      assert.equal(await token.read.name(), "BloodPointToken");
      assert.equal(await token.read.symbol(), "BPT");
      assert.equal(await token.read.decimals(), 0);
    });

    it("Should set minter to platform contract", async function () {
      const { token, bloodPoints } = await deployFixture();
      assert.equal(
        (await token.read.minter()).toLowerCase(),
        bloodPoints.address.toLowerCase()
      );
    });
  });

  describe("Minting & Burning", async function () {
    it("Should allow platform (minter) to mint points", async function () {
      const { token, bloodPoints, user } = await deployFixture();
      await bloodPoints.write.donateBlood(["A", 300], { account: user.account });
      assert.equal(await token.read.balanceOf([user.account.address]), 100n);
    });

    it("Should allow platform (minter) to burn points on redemption", async function () {
      const { token, bloodPoints, admin, user } = await deployFixture();
      await bloodPoints.write.donateBlood(["A", 300], { account: user.account });
      await bloodPoints.write.addNewProduct(["T恤", 50, 10]);
      await bloodPoints.write.redeemProduct([0n], { account: user.account });
      assert.equal(await token.read.balanceOf([user.account.address]), 50n);
    });

    it("Should reject mint from non-minter (permission)", async function () {
      const { token, user } = await deployFixture();
      await assert.rejects(
        token.write.mint([user.account.address, 1000n], { account: user.account }),
        /NotMinter/
      );
    });

    it("Should reject burnFrom from non-minter (security)", async function () {
      const { token, bloodPoints, user } = await deployFixture();
      await bloodPoints.write.donateBlood(["A", 300], { account: user.account });
      // 攻击者试图直接销毁他人积分
      await assert.rejects(
        token.write.burnFrom([user.account.address, 100n], { account: user.account }),
        /NotMinter/
      );
    });
  });

  describe("Pausable", async function () {
    it("Should block transfers when paused", async function () {
      const { token, bloodPoints, admin, user, other } = await deployFixture();
      await bloodPoints.write.donateBlood(["A", 300], { account: user.account });

      await token.write.pause();

      // 暂停期间禁止转账
      await assert.rejects(
        token.write.transfer([other.account.address, 50n], { account: user.account }),
        /EnforcedPause/
      );

      // 恢复后允许转账
      await token.write.unpause();
      await token.write.transfer([other.account.address, 50n], { account: user.account });
      assert.equal(await token.read.balanceOf([other.account.address]), 50n);
    });

    it("Should reject pause from non-owner (permission)", async function () {
      const { token, user } = await deployFixture();
      await assert.rejects(token.write.pause({ account: user.account }), /Ownable/);
    });
  });

  describe("Minter management", async function () {
    it("Should allow owner to update minter", async function () {
      const { token, admin, other } = await deployFixture();
      await token.write.setMinter([other.account.address]);
      assert.equal(
        (await token.read.minter()).toLowerCase(),
        other.account.address.toLowerCase()
      );
    });

    it("Should reject setMinter from non-owner (permission)", async function () {
      const { token, user } = await deployFixture();
      await assert.rejects(
        token.write.setMinter([user.account.address], { account: user.account }),
        /Ownable/
      );
    });

    it("Should reject setMinter with zero address (exception)", async function () {
      const { token } = await deployFixture();
      await assert.rejects(
        token.write.setMinter(["0x0000000000000000000000000000000000000000"]),
        /ZeroAddress/
      );
    });
  });
});
