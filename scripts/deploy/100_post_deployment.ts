import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { waitFor } from "../txHelper";
import { CONTRACTS, INITIAL_REWARD_RATE, INITIAL_INDEX, BOUNTY_AMOUNT } from "../constants";
import {
    BlackDaoAuthority__factory,
    Distributor__factory,
    BlackDaoERC20Token__factory,
    BlackDaoStaking__factory,
    SBlackDao__factory,
    GBLKD__factory,
    BlackDaoTreasury__factory,
} from "../../types";

// TODO: Shouldn't run setup methods if the contracts weren't redeployed.
const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
    const { deployments, getNamedAccounts, ethers } = hre;
    const { deployer } = await getNamedAccounts();
    const signer = await ethers.provider.getSigner(deployer);

    const authorityDeployment = await deployments.get(CONTRACTS.authority);
    const blkdDeployment = await deployments.get(CONTRACTS.blkd);
    const sBlkdDeployment = await deployments.get(CONTRACTS.sBlkd);
    const gBlkdDeployment = await deployments.get(CONTRACTS.gBlkd);
    const distributorDeployment = await deployments.get(CONTRACTS.distributor);
    const treasuryDeployment = await deployments.get(CONTRACTS.treasury);
    const stakingDeployment = await deployments.get(CONTRACTS.staking);

    const authorityContract = await BlackDaoAuthority__factory.connect(
        authorityDeployment.address,
        signer
    );
    const blkd = BlackDaoERC20Token__factory.connect(blkdDeployment.address, signer);
    const sBlkd = SBlackDao__factory.connect(sBlkdDeployment.address, signer);
    const gBlkd = GBLKD__factory.connect(gBlkdDeployment.address, signer);
    const distributor = Distributor__factory.connect(distributorDeployment.address, signer);
    const staking = BlackDaoStaking__factory.connect(stakingDeployment.address, signer);
    const treasury = BlackDaoTreasury__factory.connect(treasuryDeployment.address, signer);

    // Step 1: Set treasury as vault on authority
    await waitFor(authorityContract.pushVault(treasury.address, true));
    console.log("Setup -- authorityContract.pushVault: set vault on authority");

    // Step 2: Set distributor as minter on treasury
    await waitFor(treasury.enable(8, distributor.address, ethers.constants.AddressZero)); // Allows distributor to mint blkd.
    console.log("Setup -- treasury.enable(8):  distributor enabled to mint blkd on treasury");

    // Step 3: Set distributor on staking
    await waitFor(staking.setDistributor(distributor.address));
    console.log("Setup -- staking.setDistributor:  distributor set on staking");

    // Step 4: Initialize sBLKD and set the index
    if ((await sBlkd.gBLKD()) == ethers.constants.AddressZero) {
        await waitFor(sBlkd.setIndex(INITIAL_INDEX)); // TODO
        await waitFor(sBlkd.setgBLKD(gBlkd.address));
        await waitFor(sBlkd.initialize(staking.address, treasuryDeployment.address));
    }
    console.log("Setup -- sblkd initialized (index, gblkd)");

    // Step 5: Set up distributor with bounty and recipient
    await waitFor(distributor.setBounty(BOUNTY_AMOUNT));
    await waitFor(distributor.addRecipient(staking.address, INITIAL_REWARD_RATE));
    console.log("Setup -- distributor.setBounty && distributor.addRecipient");

    // Approve staking contact to spend deployer's BLKD
    // TODO: Is this needed?
    // await blkd.approve(staking.address, LARGE_APPROVAL);
};

func.tags = ["setup"];
func.dependencies = [CONTRACTS.blkd, CONTRACTS.sBlkd, CONTRACTS.gBlkd];

export default func;
