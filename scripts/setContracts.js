const { ethers } = require("hardhat");
const hre = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with the account: " + deployer.address);

    const timelock = "0";
    const epochLength = "28800";
    const firstEpochNumber = "1";
    const firstEpochTime = "1655856000";
    const index = "1";
    const warmupPeriod = "0";
    const deadAddress = "0x0000000000000000000000000000000000000000"
    const sushiRouterV2 = "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F";
    const dai = { address: "0x6b175474e89094c44da98b954eedeac495271d0f" };
    
    const mainWallet = { address: "0x9BaCec4035CfB75b6c2D02220593F44F847d53C9" };
    const preMintAmount = "5000000000000000";

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

    ////////////////////////////////////////////////////////////////

    const setIndex = await sblkd.setIndex(index);
    await setIndex.wait();
    console.log("set Index");

    const setgBLKD = await sblkd.setgBLKD(gblkd.address);
    await setgBLKD.wait();
    console.log("set gblkd in sblkd");

    const initialize = await sblkd.initialize(staking.address, treasury.address);
    await initialize.wait();
    console.log("initialize sblkd");

    const migrate = await gblkd.migrate(staking.address, sblkd.address);
    await migrate.wait();
    console.log("migrate gblkd is done");

    const setDistributor = await staking.setDistributor(distributor.address);
    await setDistributor.wait();
    console.log("setDistributor for Staking:", distributor.address);

    const setWarmupLength = await staking.setWarmupLength(warmupPeriod);
    await setWarmupLength.wait();
    console.log("setDistributor for Staking:", warmupPeriod);

    const setBounty = await distributor.setBounty("100");
    await setBounty.wait();
    console.log("Distributor Bounty Set: ", 100);

    const addRecipient = await distributor.addRecipient(staking.address, "4000");
    await addRecipient.wait();
    console.log("Distributor Add Recipient:", 4000);
    
    ////////////////////////////////////////////////////////////////

    const mint = await blkd.mint(mainWallet.address, preMintAmount);
    await mint.wait();
    console.log("Minted BLKD as Premint to: ", mainWallet.address, " amount: ", preMintAmount);

    ////////////////////////////////////////////////////////////////

    const pushVault = await authority.pushVault(treasury.address, true);
    await pushVault.wait();
    console.log("Authority Vault Pushed: ", treasury.address);

    // Treasury Primary Actions
    const enable1 = await treasury.enable(8, distributor.address, deadAddress); // Allows distributor to mint BONE.
    await enable1.wait();
    console.log("Treasury.enable(8):  distributor enabled to mint paw on treasury");

    const enable2 = await treasury.enable(0, deployer.address, deadAddress); // Enable the deployer to deposit reserve tokens
    await enable2.wait();
    console.log("Deployer Enabled on Treasury(0): ", deployer.address);

    const enable3 = await treasury.enable(0, mainWallet.address, deadAddress); // Enable the mainWallet to deposit reserve tokens
    await enable3.wait();
    console.log("mainWallet Enabled on Treasury(0): ", mainWallet.address);

    const enable4 = await treasury.enable(2, dai.address, deadAddress); // Enable DAI as a reserve Token
    await enable4.wait();
    console.log("DAI Enabled on Treasury(2) as reserve: ", dai.address);

    // Treasury Extra Roles
    const enable6 = await treasury.enable(3, deployer.address, deadAddress);
    await enable6.wait();
    const enable7 = await treasury.enable(4, deployer.address, deadAddress); 
    await enable7.wait();
    const enable8 = await treasury.enable(6, deployer.address, deadAddress); 
    await enable8.wait();
    const enable9 = await treasury.enable(7, deployer.address, deadAddress);
    await enable9.wait();
    const enable10 = await treasury.enable(8, deployer.address, deadAddress); 
    await enable10.wait();

    const enable11 = await treasury.enable(3, mainWallet.address, deadAddress);
    await enable11.wait();
    const enable12 = await treasury.enable(4, mainWallet.address, deadAddress); 
    await enable12.wait();
    const enable13 = await treasury.enable(6, mainWallet.address, deadAddress); 
    await enable13.wait();
    const enable14 = await treasury.enable(7, mainWallet.address, deadAddress);
    await enable14.wait();
    const enable15 = await treasury.enable(8, mainWallet.address, deadAddress); 
    await enable15.wait();

    const enable16 = await treasury.enable(0, bondDepository.address, deadAddress);
    await enable16.wait();
    const enable17 = await treasury.enable(4, bondDepository.address, deadAddress);
    await enable17.wait();
    const enable18 = await treasury.enable(8, bondDepository.address, deadAddress);
    await enable18.wait();
    const enable19 = await treasury.enable(7, bondDepository.address, deadAddress);
    await enable19.wait();
    const enable20 = await treasury.enable(10, bondDepository.address, deadAddress);
    await enable20.wait();

    const enable21 = await treasury.enable(9, sblkd.address, deadAddress);
    await enable21.wait();

    /////////////////////////////////////////////////////////////////////////////////

    const initializeTreasury = await treasury.initialize();
    await initializeTreasury.wait();
    console.log("Treasury Initialized");

    ////////////////////////////////////////////////////////////////////////////////
    // Adding Liquidity

    try {

        let LP_ROUTER = await ethers.getContractAt("IUniswapV2Router", sushiRouterV2);
        let WETH = await LP_ROUTER.WETH();
        let FACTORY = await LP_ROUTER.factory();
        let LP_FACTORY = await ethers.getContractAt("IUniswapV2Factory", FACTORY.toString());

        let BLKD_DAI_LP_PAIR = await LP_FACTORY.createPair(
            blkd.address,
            dai.address
        );
        await BLKD_DAI_LP_PAIR.wait();
        console.log("BLKD_DAI_LP_PAIR Created:", BLKD_DAI_LP_PAIR);

        let BLKD_ETH_LP_PAIR = await LP_FACTORY.createPair(
            blkd.address,
            WETH
        );
        await BLKD_ETH_LP_PAIR.wait();
        console.log("BLKD_ETH_LP_PAIR Created:", BLKD_ETH_LP_PAIR);


        let BLKD_DAI_PAIR_RETURNED = await LP_FACTORY.getPair(
            blkd.address,
            dai.address
        );
        console.log("BLKD_DAI_LP Pair:", BLKD_DAI_PAIR_RETURNED);

        let BLKD_ETH_PAIR_RETURNED = await LP_FACTORY.getPair(
            blkd.address,
            WETH
        );
        console.log("BLKD_ETH_LP Pair:",BLKD_ETH_PAIR_RETURNED);

    } catch (error) {
        console.log("errorrrr", error);
    }

    ////////////////////////////////////////////////////////////////////////////////

    console.log("All contracts set successfully");
    
}

main()
    .then(() => process.exit())
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
