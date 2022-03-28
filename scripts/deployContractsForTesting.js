const { ethers } = require("hardhat");
const hre = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with the account: " + deployer.address);

    const timelock = "0";
    const epochLength = "28800";
    const firstEpochNumber = "1";
    const firstEpochTime = ((new Date().getTime()) / 1000.0).toFixed(0).toString();
    const index = "1";
    const chainID = "4";
    const warmupPeriod = "0";
    const deadAddress = "0x0000000000000000000000000000000000000000"
    const vestingTimeInSeconds = 432000;       // 5 DAYS
    const daysOfBond = 14*24*60*60*1000;       // 14 Days
    const bondEndDate = (new Date().getTime() + daysOfBond);
    const conclusionTime = ( bondEndDate / 1000 ).toFixed(0).toString();
    const depositIntervalsInSeconds = 3600;
    const tuneIntervalsInSeconds = 86400;
    const frontEndRewarder = deployer.address;
    const frontEndReward = "1"; 
    const daoReward = "1";

    const Authority = await ethers.getContractFactory("OlympusAuthority");
    const authority = await Authority.deploy(
        deployer.address,
        deployer.address,
        deployer.address,
        deployer.address
    );
    await authority.deployed();
    console.log("authority: ", authority.address);

    const BLKD = await ethers.getContractFactory("OlympusERC20Token");
    const blkd = await BLKD.deploy(authority.address);
    await blkd.deployed();
    console.log("blkd: ", blkd.address);

    const SBLKD = await ethers.getContractFactory("sOlympus");
    const sblkd = await SBLKD.deploy();
    await sblkd.deployed();
    console.log("sblkd: ", sblkd.address);

    const Treasury = await ethers.getContractFactory("OlympusTreasury");
    const treasury = await Treasury.deploy(blkd.address, timelock, authority.address);
    await treasury.deployed();
    console.log("treasury: ", treasury.address);

    const GBLKD = await ethers.getContractFactory("gOHM");
    const gblkd = await GBLKD.deploy(deployer.address, sblkd.address);
    await gblkd.deployed();
    console.log("gblkd: ", gblkd.address);

    const Staking = await ethers.getContractFactory("OlympusStaking");
    const staking = await Staking.deploy(
        blkd.address,
        sblkd.address,
        gblkd.address,
        epochLength,
        firstEpochNumber,
        firstEpochTime,
        authority.address
    );
    await staking.deployed();
    console.log("staking: ", staking.address);

    const Distributor = await ethers.getContractFactory("Distributor");
    const distributor = await Distributor.deploy(
        treasury.address,
        blkd.address,
        staking.address,
        authority.address
    );
    await distributor.deployed();
    console.log("distributor: ", distributor.address);

    const BondingCalculator = await ethers.getContractFactory("OlympusBondingCalculator");
    const bondingCalculator = await BondingCalculator.deploy(blkd.address);
    await bondingCalculator.deployed();
    console.log("bondingCalculator: ", bondingCalculator.address);

    const BondDepository = await ethers.getContractFactory("OlympusBondDepositoryV2");
    const bondDepository = await BondDepository.deploy(
        authority.address,
        blkd.address,
        gblkd.address,
        staking.address,
        treasury.address
    );
    await bondDepository.deployed();
    console.log("bondDepository: ", bondDepository.address);

    const DAI = await ethers.getContractFactory("DAI");
    const dai = await DAI.deploy(chainID);
    await dai.deployed();
    console.log("DAI: ", dai.address);

    const FRAX = await ethers.getContractFactory("FRAX");
    const frax = await FRAX.deploy(chainID);
    await frax.deployed();
    console.log("FRAX: ", frax.address);

    const YieldDirector = await ethers.getContractFactory("YieldDirector");
    const yieldDirector = await YieldDirector.deploy(
        sblkd.address,
        authority.address
    );
    await yieldDirector.deployed();
    console.log("yieldDirector: ", yieldDirector.address);

    ////////////////////////////////////////////////////////////////

    await sblkd.setIndex(index);
    console.log("set Index");

    await sblkd.setgOHM(gblkd.address);
    console.log("set gblkd in sblkd");

    await sblkd.initialize(staking.address, treasury.address);
    console.log("initialize sblkd");

    await gblkd.migrate(staking.address, sblkd.address);
    console.log("migrate gblkd is done");

    await staking.setDistributor(distributor.address);
    console.log("setDistributor for Staking:", distributor.address);

    await staking.setWarmupLength(warmupPeriod);
    console.log("setDistributor for Staking:", warmupPeriod);

    await dai.mint(deployer.address, "100000000000000000000000000000000000000")
    console.log("Minted DAI: ", "100000000000000000000");

    await frax.mint(deployer.address, "100000000000000000000000000000000000000")
    console.log("Minted FRAX: ", "100000000000000000000");

    await distributor.setBounty("100");
    console.log("Distributor Bounty Set: ", 100);

    await distributor.addRecipient(staking.address, "4000");
    console.log("Distributor Add Recipient:", 4000);

    ////////////////////////////////////////////////////////////////////////////////

    let liquidityAmountBLKD = "100000000000000000000000";
    let liquidityAmountDAI = "1000000000000000000000000000000000000";
    let liquidityAmountFRAX = "1000000000000000000000000000000000000";
    let deadline = new Date().getTime();
    deadline += (60 * 60 * 1000);
    let LP_ROUTER = await ethers.getContractAt("IUniswapV2Router",sushiRouterV2);
    let WETH = await LP_ROUTER.WETH();
    let FACTORY = await LP_ROUTER.factory();
    let LP_FACTORY = await ethers.getContractAt("IUniswapV2Factory", FACTORY);

    await dai.approve(sushiRouterV2,liquidityAmountDAI);
    await blkd.approve(sushiRouterV2,liquidityAmountBLKD);
    await LP_FACTORY.createPair(
        blkd.address,
        dai.address
    )
    // await LP_ROUTER.addLiquidity(
    //     blkd.address,
    //     dai.address,
    //     liquidityAmountBLKD,
    //     liquidityAmountDAI,
    //     0,
    //     0,
    //     deployer.address,
    //     deadline
    // );
    let BLKD_DAI_PAIR_RETURNED = await LP_FACTORY.getPair(
        blkd.address,
        dai.address
    );
    console.log("BLKD_DAI_LP Pair:", BLKD_DAI_PAIR_RETURNED);

    await frax.approve(sushiRouterV2,liquidityAmountFRAX);
    await blkd.approve(sushiRouterV2,liquidityAmountBLKD);
    await LP_FACTORY.createPair(
        blkd.address,
        frax.address
    )
    // await LP_ROUTER.addLiquidity(
    //     blkd.address,
    //     frax.address,
    //     liquidityAmountBLKD,
    //     liquidityAmountFRAX,
    //     0,
    //     0,
    //     deployer.address,
    //     deadline
    // );
    let BLKD_FRAX_PAIR_RETURNED = await LP_FACTORY.getPair(
        blkd.address,
        frax.address
    );
    console.log("BLKD_FRAX_LP Pair:",BLKD_FRAX_PAIR_RETURNED);

    await blkd.approve(sushiRouterV2,liquidityAmountBLKD);
    await LP_FACTORY.createPair(
        WETH,
        blkd.address
    )
    // let options = {value: ethers.utils.parseEther("0.10")}
    // await LP_ROUTER.addLiquidityETH(
    //     blkd.address,
    //     liquidityAmountBLKD,
    //     0,
    //     0,
    //     deployer.address,
    //     deadline
    // , options );

    let BLKD_ETH_PAIR_RETURNED = await LP_FACTORY.getPair(
        WETH,
        blkd.address
    );
    console.log("BLKD_ETH_LP Pair:",BLKD_ETH_PAIR_RETURNED);

    ////////////////////////////////////////////////////////////////
    
    ////////////////////////////////////////////////////////////////////////////////

    await authority.pushVault(treasury.address, true);
    console.log("Authority Vault Pushed: ", treasury.address);

    // Treasury Primary Actions
    await treasury.enable(8, distributor.address, deadAddress); // Allows distributor to mint BLKD.
    console.log("Treasury.enable(8):  distributor enabled to mint ohm on treasury");
    await treasury.enable(0, deployer.address, deadAddress); // Enable the deployer to deposit reserve tokens
    console.log("Deployer Enabled on Treasury(0): ", deployer.address);
    await treasury.enable(2, dai.address, deadAddress); // Enable DAI as a reserve Token
    console.log("DAI Enabled on Treasury(2) as reserve: ", dai.address);
    await treasury.enable(2, frax.address, deadAddress); // Enable FRAX as a reserve Token
    console.log("FRAX Enabled on Treasury(2) as reserve: ", frax.address);

    // Treasury Extra Roles
    await treasury.enable(3, deployer.address, deadAddress);
    await treasury.enable(4, deployer.address, deadAddress); 
    await treasury.enable(6, deployer.address, deadAddress); 
    await treasury.enable(7, deployer.address, deadAddress);
    await treasury.enable(8, deployer.address, deadAddress); 

    await treasury.enable(0, bondDepository.address, deadAddress);
    await treasury.enable(4, bondDepository.address, deadAddress);
    await treasury.enable(8, bondDepository.address, deadAddress);
    await treasury.enable(7, bondDepository.address, deadAddress);
    await treasury.enable(10, bondDepository.address, deadAddress);

    await treasury.enable(9, sblkd.address, deadAddress);

    // Deposit and Mint blkd
    const daiAmount = "100000000000000000000000000000000"
    await dai.approve(treasury.address, daiAmount); // Approve treasury to use the DAI
    console.log("DAI Approved to treasury :", daiAmount);
    await treasury.deposit(daiAmount, dai.address, "0"); // Deposit DAI into treasury
    console.log("DAI Deposited in treasury :", daiAmount);
    const blkdMintedAgainstDai = await blkd.balanceOf(deployer.address);
    console.log("BLKD minted against DAI: ", blkdMintedAgainstDai.toString());

    const fraxAmount = "100000000000000000000000000000000"
    await frax.approve(treasury.address, fraxAmount); // Approve treasury to use the FRAX
    console.log("FRAX Approved to treasury :", fraxAmount);
    await treasury.deposit(fraxAmount, frax.address, "0"); // Deposit FRAX into treasury
    console.log("FRAX Deposited in treasury :", fraxAmount);
    const blkdMintedAgainstFrax = await blkd.balanceOf(deployer.address);
    console.log("BLKD minted against FRAX: ", blkdMintedAgainstFrax.toString());

    // Deposit Excess Reserves 
    const daiAmountForReserves = "100000000000000000000000000000000"
    await dai.approve(treasury.address, daiAmountForReserves); // Approve treasury to use the DAI
    console.log("DAI Approved to treasury :", daiAmountForReserves);
    await treasury.deposit(daiAmountForReserves, dai.address, "100000000000000000000000"); // Deposit DAI into treasury
    console.log("DAI Deposited in treasury :", daiAmountForReserves);

    const fraxAmountForReserves = "100000000000000000000000000000000"
    await frax.approve(treasury.address, fraxAmountForReserves); // Approve treasury to use the FRAX
    console.log("FRAX Approved to treasury :", fraxAmountForReserves);
    await treasury.deposit(fraxAmountForReserves, frax.address, "100000000000000000000000"); // Deposit FRAX into treasury
    console.log("FRAX Deposited in treasury :", fraxAmountForReserves);

    ////////////////////////////////////////////////////////////
    // BONDS

    await bondDepository.create(
        dai.address,
        ["100000000000000000000000","1000000000","10000"],
        [true,true],
        [vestingTimeInSeconds,conclusionTime],
        [depositIntervalsInSeconds,tuneIntervalsInSeconds]
    )
    console.log("DAI BOND CREATED")

    await bondDepository.create(
        frax.address,
        ["100000000000000000000000","1000000000","10000"],
        [true,true],
        [vestingTimeInSeconds,conclusionTime],
        [depositIntervalsInSeconds,tuneIntervalsInSeconds]
    )
    console.log("FRAX BOND CREATED")

    await bondDepository.whitelist(frontEndRewarder);
    await bondDepository.setRewards(frontEndReward, daoReward);

    /////////////////////////////////////////////////////////////////////////////////

    treasury.initialize();
    console.log("Treasury Initialized");

    /////////////////////////////////////////////////////////////////////////////////

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

    try {
        await hre.run("verify:verify", {
            address: dai.address,
            constructorArguments: [
                chainID
            ],
        });
    } catch (error) {}

    try {
        await hre.run("verify:verify", {
            address: frax.address,
            constructorArguments: [
                chainID
            ],
        });
    } catch (error) {}

    try {
        await hre.run("verify:verify", {
            address: yieldDirector.address,
            constructorArguments: [
                sblkd.address,
                authority.address
            ],
        });
    } catch (error) {}

    console.log("All contracts deployed successfully");
}

main()
    .then(() => process.exit())
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
