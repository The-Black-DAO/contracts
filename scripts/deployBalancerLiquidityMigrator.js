const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with the account: " + deployer.address);

    const Authority = "0x00Aae7E153FA5F0D0f722d29CAB97ccBB5d4FA55";

    const BalancerLiquidityMigrator = await ethers.getContractFactory("BalancerLiquidityMigrator");
    const balancerLiquidityMigrator = await BalancerLiquidityMigrator.deploy(Authority);

    console.log("Balancer Liquidity Migrator: " + balancerLiquidityMigrator.address);
}

main()
    .then(() => process.exit())
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
