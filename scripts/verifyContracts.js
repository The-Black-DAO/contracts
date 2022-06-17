const { ethers } = require("hardhat");
const hre = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();

    const timelock = "0";
    const epochLength = "28800";
    const firstEpochNumber = "1";
    const firstEpochTime = "1655856000";

    const authorityAddress = "0x12275F627852aACa259B6752BdC8e60FC28EEca6";
    const blkdAddress = "0xe7DA1d8327AE1F320BbC23ca119b02AD3f85dceB";
    const sblkdAddress = "0x76B7B4062d7b518C79f324b6F1f9Cc4E10ABD27F";
    const treasuryAddress = "";
    const gblkdAddress = "";
    const stakingAddress = "";
    const distributorAddress = "";
    const bondingCalculatorAddress = "";
    const bondDepositoryAddress = "";

    const authority = await ethers.getContractAt("BlackDAOAuthority", authorityAddress);
    const blkd = await ethers.getContractAt("BlackDAOERC20Token", blkdAddress);
    const sblkd = await ethers.getContractAt("sBlackDAO", sblkdAddress);
    const treasury = await ethers.getContractAt("BlackDAOTreasury", treasuryAddress);
    const gblkd = await ethers.getContractAt("gBLKD", gblkdAddress);
    const staking = await ethers.getContractAt("BlackDAOStaking", stakingAddress);
    const distributor = await ethers.getContractAt("Distributor", distributorAddress);
    const bondingCalculator = await ethers.getContractAt("BlackDAOBondingCalculator", bondingCalculatorAddress);
    const bondDepository = await ethers.getContractAt("BlackDAOBondDepositoryV2", bondDepositoryAddress);

    try {
        await hre.run("verify:verify", {
            address: authority.address,
            constructorArguments: [
                deployer.address,
                deployer.address,
                deployer.address,
                deployer.address,
            ],
        });
    } catch (error) {}

    try {
        await hre.run("verify:verify", {
            address: blkd.address,
            constructorArguments: [authority.address],
        });
    } catch (error) {}

    try {
        await hre.run("verify:verify", {
            address: sblkd.address,
            constructorArguments: [],
        });
    } catch (error) {}

    try {
        await hre.run("verify:verify", {
            address: treasury.address,
            constructorArguments: [blkd.address, timelock, authority.address],
        });
    } catch (error) {}

    try {
        await hre.run("verify:verify", {
            address: gblkd.address,
            constructorArguments: [deployer.address, sblkd.address],
        });
    } catch (error) {}

    try {
        await hre.run("verify:verify", {
            address: staking.address,
            constructorArguments: [
                blkd.address,
                sblkd.address,
                gblkd.address,
                epochLength,
                firstEpochNumber,
                firstEpochTime,
                authority.address
            ],
        });
    } catch (error) {}

    try {
        await hre.run("verify:verify", {
            address: distributor.address,
            constructorArguments: [
                treasury.address,
                blkd.address,
                staking.address,
                authority.address
            ],
        });
    } catch (error) {}

    try {
        await hre.run("verify:verify", {
            address: bondingCalculator.address,
            constructorArguments: [blkd.address],
        });
    } catch (error) {}

    try {
        await hre.run("verify:verify", {
            address: bondDepository.address,
            constructorArguments: [
                authority.address,
                blkd.address,
                gblkd.address,
                staking.address,
                treasury.address
            ],
        });
    } catch (error) {}

    console.log("All contracts verified successfully");
}

main()
    .then(() => process.exit())
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
