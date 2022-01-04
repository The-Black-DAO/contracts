import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";
import { expect } from "chai";
import { ethers } from "hardhat";

import {
  BlackDaoERC20Token,
  BlackDaoERC20Token__factory,
  BlackDaoAuthority__factory
} from '../../types';

describe("BlackDaoTest", () => {
  let deployer: SignerWithAddress;
  let vault: SignerWithAddress;
  let bob: SignerWithAddress;
  let alice: SignerWithAddress;
  let blkd: BlackDaoERC20Token;

  beforeEach(async () => {
    [deployer, vault, bob, alice] = await ethers.getSigners();

    const authority = await (new BlackDaoAuthority__factory(deployer)).deploy(deployer.address, deployer.address, deployer.address, vault.address);
    await authority.deployed();

    blkd = await (new BlackDaoERC20Token__factory(deployer)).deploy(authority.address);

  });

  it("correctly constructs an ERC20", async () => {
    expect(await blkd.name()).to.equal("BlackDao");
    expect(await blkd.symbol()).to.equal("BLKD");
    expect(await blkd.decimals()).to.equal(9);
  });

  describe("mint", () => {
    it("must be done by vault", async () => {
      await expect(blkd.connect(deployer).mint(bob.address, 100)).
        to.be.revertedWith("UNAUTHORIZED");
    });

    it("increases total supply", async () => {
      let supplyBefore = await blkd.totalSupply();
      await blkd.connect(vault).mint(bob.address, 100);
      expect(supplyBefore.add(100)).to.equal(await blkd.totalSupply());
    });
  });

  describe("burn", () => {
    beforeEach(async () => {
      await blkd.connect(vault).mint(bob.address, 100);
    });

    it("reduces the total supply", async () => {
      let supplyBefore = await blkd.totalSupply();
      await blkd.connect(bob).burn(10);
      expect(supplyBefore.sub(10)).to.equal(await blkd.totalSupply());
    });

    it("cannot exceed total supply", async () => {
      let supply = await blkd.totalSupply();
      await expect(blkd.connect(bob).burn(supply.add(1))).
        to.be.revertedWith("ERC20: burn amount exceeds balance");
    });

    it("cannot exceed bob's balance", async () => {
      await blkd.connect(vault).mint(alice.address, 15);
      await expect(blkd.connect(alice).burn(16)).
        to.be.revertedWith("ERC20: burn amount exceeds balance");
    });
  });
});