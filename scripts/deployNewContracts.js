const { ethers } = require("hardhat");

async function main() {

    const [deployer] = await ethers.getSigners();
    console.log('Deploying contracts with the account: ' + deployer.address);


    const firstEpochNumber = "";
    const firstBlockNumber = "";
    const gBLKD = "";
    const authority = "";

    const BLKD = await ethers.getContractFactory('BlackDaoERC20Token');
    const blkd = await BLKD.deploy(authority);

    const BlackDaoTreasury = await ethers.getContractFactory('BlackDaoTreasury');
    const blackTreasury = await BlackDaoTreasury.deploy(blkd.address, '0', authority);

    const SBLKD = await ethers.getContractFactory('sBlackDao');
    const sBLKD = await SBLKD.deploy();

    const BlackDaoStaking = await ethers.getContractFactory('BlackDaoStaking');
    const staking = await BlackDaoStaking.deploy(blkd.address, sBLKD.address, gBLKD, '2200', firstEpochNumber, firstBlockNumber, authority);

    const Distributor = await ethers.getContractFactory('Distributor');
    const distributor = await Distributor.deploy(blackTreasury.address, blkd.address, staking.address, authority );

    await sBLKD.setIndex('');
    await sBLKD.setgBLKD(gBLKD);
    await sBLKD.initialize(staking.address, blackTreasury.address);
    


    console.log("BLKD: " + blkd.address);
    console.log("BlackDao Treasury: " + blackTreasury.address);
    console.log("Staked BlackDao: " + sBLKD.address);
    console.log("Staking Contract: " + staking.address);
    console.log("Distributor: " + distributor.address);
}

main()
    .then(() => process.exit())
    .catch(error => {
        console.error(error);
        process.exit(1);
})