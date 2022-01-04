const { ethers } = require("hardhat");

async function main() {

    const [deployer] = await ethers.getSigners();
    console.log('Deploying contracts with the account: ' + deployer.address);

    const oldsBLKD = "0x1Fecda1dE7b6951B248C0B62CaeBD5BAbedc2084";

    const WSBLKD = await ethers.getContractFactory('wBLKD');
    const wsBLKD = await WSBLKD.deploy(oldsBLKD);

  console.log("old wsBLKD: " + wsBLKD.address);
}

main()
    .then(() => process.exit())
    .catch(error => {
        console.error(error);
        process.exit(1);
})