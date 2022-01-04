const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with the account: " + deployer.address);

    const DAI = "0xB2180448f8945C8Cc8AE9809E67D6bd27d8B2f2C";
    const oldBLKD = "0xC0b491daBf3709Ee5Eb79E603D73289Ca6060932";
    const oldsBLKD = "0x1Fecda1dE7b6951B248C0B62CaeBD5BAbedc2084";
    const oldStaking = "0xC5d3318C0d74a72cD7C55bdf844e24516796BaB2";
    const oldwsBLKD = "0xe73384f11Bb748Aa0Bc20f7b02958DF573e6E2ad";
    const sushiRouter = "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506";
    const uniRouter = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
    const oldTreasury = "0x0d722D813601E48b7DAcb2DF9bae282cFd98c6E7";

    const FRAX = "0x2f7249cb599139e560f0c81c269ab9b04799e453";
    const LUSD = "0x45754df05aa6305114004358ecf8d04ff3b84e26";

    const Authority = await ethers.getContractFactory("BlackDaoAuthority");
    const authority = await Authority.deploy(
        deployer.address,
        deployer.address,
        deployer.address,
        deployer.address
    );

    const Migrator = await ethers.getContractFactory("BlackDaoTokenMigrator");
    const migrator = await Migrator.deploy(
        oldBLKD,
        oldsBLKD,
        oldTreasury,
        oldStaking,
        oldwsBLKD,
        sushiRouter,
        uniRouter,
        "0",
        authority.address
    );

    const firstEpochNumber = "550";
    const firstBlockNumber = "9505000";

    const BLKD = await ethers.getContractFactory("BlackDaoERC20Token");
    const blkd = await BLKD.deploy(authority.address);

    const SBLKD = await ethers.getContractFactory("sBlackDao");
    const sBLKD = await SBLKD.deploy();

    const GBLKD = await ethers.getContractFactory("gBLKD");
    const gBLKD = await GBLKD.deploy(migrator.address, sBLKD.address);

    await migrator.setgBLKD(gBLKD.address);

    const BlackDaoTreasury = await ethers.getContractFactory("BlackDaoTreasury");
    const blackTreasury = await BlackDaoTreasury.deploy(blkd.address, "0", authority.address);

    await blackTreasury.queueTimelock("0", migrator.address, migrator.address);
    await blackTreasury.queueTimelock("8", migrator.address, migrator.address);
    await blackTreasury.queueTimelock("2", DAI, DAI);
    await blackTreasury.queueTimelock("2", FRAX, FRAX);
    await blackTreasury.queueTimelock("2", LUSD, LUSD);

    await authority.pushVault(blackTreasury.address, true); // replaces blkd.setVault(treasury.address)

    const BlackDaoStaking = await ethers.getContractFactory("BlackDaoStaking");
    const staking = await BlackDaoStaking.deploy(
        blkd.address,
        sBLKD.address,
        gBLKD.address,
        "2200",
        firstEpochNumber,
        firstBlockNumber,
        authority.address
    );

    const Distributor = await ethers.getContractFactory("Distributor");
    const distributor = await Distributor.deploy(
        blackTreasury.address,
        blkd.address,
        staking.address,
        authority.address
    );

    // Initialize sblkd
    await sBLKD.setIndex("7675210820");
    await sBLKD.setgBLKD(gBLKD.address);
    await sBLKD.initialize(staking.address, blackTreasury.address);

    await staking.setDistributor(distributor.address);

    await blackTreasury.execute("0");
    await blackTreasury.execute("1");
    await blackTreasury.execute("2");
    await blackTreasury.execute("3");
    await blackTreasury.execute("4");

    console.log("BlackDao Authority: ", authority.address);
    console.log("BLKD: " + blkd.address);
    console.log("sBlkd: " + sBLKD.address);
    console.log("gBLKD: " + gBLKD.address);
    console.log("BlackDao Treasury: " + blackTreasury.address);
    console.log("Staking Contract: " + staking.address);
    console.log("Distributor: " + distributor.address);
    console.log("Migrator: " + migrator.address);
}

main()
    .then(() => process.exit())
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
