import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { FakeContract, smock } from '@defi-wonderland/smock'

import {
  IStaking,
  IERC20,
  IgBLKD,
  BlackDaoERC20Token,
  BlackDaoERC20Token__factory,
  SBlackDao,
  SBlackDao__factory,
  GBLKD,
  BlackDaoAuthority__factory,
  ITreasury,
} from '../../types';

const TOTAL_GONS = 5000000000000000;
const ZERO_ADDRESS = ethers.utils.getAddress("0x0000000000000000000000000000000000000000");

describe("sBlkd", () => {
  let initializer: SignerWithAddress;
  let treasury: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let blkd: BlackDaoERC20Token;
  let sBlkd: SBlackDao;
  let gBlkdFake: FakeContract<GBLKD>;
  let stakingFake: FakeContract<IStaking>;
  let treasuryFake: FakeContract<ITreasury>;

  beforeEach(async () => {
    [initializer, alice, bob] = await ethers.getSigners();
    stakingFake = await smock.fake<IStaking>('IStaking');
    treasuryFake = await smock.fake<ITreasury>('ITreasury');
    gBlkdFake = await smock.fake<GBLKD>('gBLKD');

    const authority = await (new BlackDaoAuthority__factory(initializer)).deploy(initializer.address, initializer.address, initializer.address, initializer.address);
    blkd = await (new BlackDaoERC20Token__factory(initializer)).deploy(authority.address);
    sBlkd = await (new SBlackDao__factory(initializer)).deploy();
  });

  it("is constructed correctly", async () => {
    expect(await sBlkd.name()).to.equal("Staked BLKD");
    expect(await sBlkd.symbol()).to.equal("sBLKD");
    expect(await sBlkd.decimals()).to.equal(9);
  });

  describe("initialization", () => {
    describe("setIndex", () => {
      it("sets the index", async () => {
        await sBlkd.connect(initializer).setIndex(3);
        expect(await sBlkd.index()).to.equal(3);
      });

      it("must be done by the initializer", async () => {
        await expect(sBlkd.connect(alice).setIndex(3)).to.be.reverted;
      });

      it("cannot update the index if already set", async () => {
        await sBlkd.connect(initializer).setIndex(3);
        await expect(sBlkd.connect(initializer).setIndex(3)).to.be.reverted;
      });
    });

    describe("setgBLKD", () => {
      it("sets gBlkdFake", async () => {
        await sBlkd.connect(initializer).setgBLKD(gBlkdFake.address);
        expect(await sBlkd.gBLKD()).to.equal(gBlkdFake.address);
      });

      it("must be done by the initializer", async () => {
        await expect(sBlkd.connect(alice).setgBLKD(gBlkdFake.address)).to.be.reverted;
      });

      it("won't set gBlkdFake to 0 address", async () => {
        await expect(sBlkd.connect(initializer).setgBLKD(ZERO_ADDRESS)).to.be.reverted;
      });
    });

    describe("initialize", () => {
      it("assigns TOTAL_GONS to the stakingFake contract's balance", async () => {
        await sBlkd.connect(initializer).initialize(stakingFake.address, treasuryFake.address);
        expect(await sBlkd.balanceOf(stakingFake.address)).to.equal(TOTAL_GONS);
      });

      it("emits Transfer event", async () => {
        await expect(sBlkd.connect(initializer).initialize(stakingFake.address, treasuryFake.address)).
          to.emit(sBlkd, "Transfer").withArgs(ZERO_ADDRESS, stakingFake.address, TOTAL_GONS);
      });

      it("emits LogStakingContractUpdated event", async () => {
        await expect(sBlkd.connect(initializer).initialize(stakingFake.address, treasuryFake.address)).
          to.emit(sBlkd, "LogStakingContractUpdated").withArgs(stakingFake.address);
      });

      it("unsets the initializer, so it cannot be called again", async () => {
        await sBlkd.connect(initializer).initialize(stakingFake.address, treasuryFake.address);
        await expect(sBlkd.connect(initializer).initialize(stakingFake.address, treasuryFake.address)).to.be.reverted;
      });
    });
  });

  describe("post-initialization", () => {
    beforeEach(async () => {
      await sBlkd.connect(initializer).setIndex(1);
      await sBlkd.connect(initializer).setgBLKD(gBlkdFake.address);
      await sBlkd.connect(initializer).initialize(stakingFake.address, treasuryFake.address);
    });

    describe("approve", () => {
      it("sets the allowed value between sender and spender", async () => {
        await sBlkd.connect(alice).approve(bob.address, 10);
        expect(await sBlkd.allowance(alice.address, bob.address)).to.equal(10);
      });

      it("emits an Approval event", async () => {
        await expect(await sBlkd.connect(alice).approve(bob.address, 10)).
          to.emit(sBlkd, "Approval").withArgs(alice.address, bob.address, 10);
      });
    });

    describe("increaseAllowance", () => {
      it("increases the allowance between sender and spender", async () => {
        await sBlkd.connect(alice).approve(bob.address, 10);
        await sBlkd.connect(alice).increaseAllowance(bob.address, 4);

        expect(await sBlkd.allowance(alice.address, bob.address)).to.equal(14);
      });

      it("emits an Approval event", async () => {
        await sBlkd.connect(alice).approve(bob.address, 10);
        await expect(await sBlkd.connect(alice).increaseAllowance(bob.address, 4)).
          to.emit(sBlkd, "Approval").withArgs(alice.address, bob.address, 14);
      });
    });

    describe("decreaseAllowance", () => {
      it("decreases the allowance between sender and spender", async () => {
        await sBlkd.connect(alice).approve(bob.address, 10);
        await sBlkd.connect(alice).decreaseAllowance(bob.address, 4);

        expect(await sBlkd.allowance(alice.address, bob.address)).to.equal(6);
      });

      it("will not make the value negative", async () => {
        await sBlkd.connect(alice).approve(bob.address, 10);
        await sBlkd.connect(alice).decreaseAllowance(bob.address, 11);

        expect(await sBlkd.allowance(alice.address, bob.address)).to.equal(0);
      });

      it("emits an Approval event", async () => {
        await sBlkd.connect(alice).approve(bob.address, 10);
        await expect(await sBlkd.connect(alice).decreaseAllowance(bob.address, 4)).
          to.emit(sBlkd, "Approval").withArgs(alice.address, bob.address, 6);
      });
    });

    describe("circulatingSupply", () => {
      it("is zero when all owned by stakingFake contract", async () => {
        await stakingFake.supplyInWarmup.returns(0);
        await gBlkdFake.totalSupply.returns(0);
        await gBlkdFake.balanceFrom.returns(0);

        const totalSupply = await sBlkd.circulatingSupply();
        expect(totalSupply).to.equal(0);
      });

      it("includes all supply owned by gBlkdFake", async () => {
        await stakingFake.supplyInWarmup.returns(0);
        await gBlkdFake.totalSupply.returns(10);
        await gBlkdFake.balanceFrom.returns(10);

        const totalSupply = await sBlkd.circulatingSupply();
        expect(totalSupply).to.equal(10);
      });


      it("includes all supply in warmup in stakingFake contract", async () => {
        await stakingFake.supplyInWarmup.returns(50);
        await gBlkdFake.totalSupply.returns(0);
        await gBlkdFake.balanceFrom.returns(0);

        const totalSupply = await sBlkd.circulatingSupply();
        expect(totalSupply).to.equal(50);
      });
    });
  });
});