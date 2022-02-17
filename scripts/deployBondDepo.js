const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with the account: " + deployer.address);

    const authority = "0x00Aae7E153FA5F0D0f722d29CAB97ccBB5d4FA55";
    const ohm = "0x1A71357E380E0757419D9eDC9F7450F640Cb80A4";
    const gohm = "0x7c1Aff8129eE863a9e6fd40c77Ad3C86eFdDf914";
    const staking = "0x3745Af869EF6F199291E7A7BA03d5EC9a3dE33f4";
    const treasury = "0x312d195baF5D5c074eeF39d7f757d0FEc0e40D63";

    const depoFactory = await ethers.getContractFactory("OlympusBondDepositoryV2");

    const depo = await depoFactory.deploy(authority, ohm, gohm, staking, treasury);

    console.log("Bond Depo: " + depo.address);
}

main()
    .then(() => process.exit())
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
