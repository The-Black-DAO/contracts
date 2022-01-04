// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.7.5;
pragma abicoder v2;

import "ds-test/test.sol"; // ds-test

import "../../../contracts/libraries/SafeMath.sol";
import "../../../contracts/libraries/FixedPoint.sol";
import "../../../contracts/libraries/FullMath.sol";
import "../../../contracts/BondDepository.sol";
import "../../../contracts/Staking.sol";
import "../../../contracts/BlackDaoERC20.sol";
import "../../../contracts/sBlackDaoERC20.sol";
import "../../../contracts/StandardBondingCalculator.sol";
import "../../../contracts/interfaces/IUniswapV2Pair.sol";
import "../../../contracts/interfaces/IERC20Metadata.sol";
import "../../../contracts/Treasury.sol";
import "../../../contracts/BondDepository.sol";
import "../../../contracts/BlackDaoAuthority.sol";
import "./util/Hevm.sol";
import "../../../contracts/BondTeller.sol";
import "../../../contracts/governance/gBLKD.sol";
import "./util/MockContract.sol";

contract BondDepositoryTest is DSTest {
    using FixedPoint for *;
    using SafeMath for uint256;
    using SafeMath for uint112;

    BlackDaoBondDepository internal bondDepository;
    BlackDaoStaking internal staking;
    BlackDaoBondingCalculator internal bondingCalculator;
    BlackDaoTreasury internal treasury;
    BondTeller internal teller;
    BlackDaoAuthority internal authority;

    BlackDaoERC20Token internal blkd;
    sBlackDao internal sblkd;
    gBLKD internal gblkd;

    MockContract internal abcToken;

    /// @dev Hevm setup
    Hevm internal constant hevm = Hevm(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);

    function setUp() public {
        // Start at timestamp
        hevm.warp(0);
        hevm.roll(0);

        authority = new BlackDaoAuthority(address(this), address(this), address(this), address(this));

        blkd = new BlackDaoERC20Token(address(authority));
        gblkd = new gBLKD(address(this), address(this));
        sblkd = new sBlackDao();
        sblkd.setIndex(10);
        sblkd.setgBLKD(address(gblkd));

        abcToken = new MockContract();
        abcToken.givenMethodReturn(abi.encodeWithSelector(ERC20.name.selector), abi.encode("ABC DAO"));
        abcToken.givenMethodReturn(abi.encodeWithSelector(ERC20.symbol.selector), abi.encode("ABC"));
        abcToken.givenMethodReturnUint(abi.encodeWithSelector(ERC20.decimals.selector), 18);

        bondingCalculator = new BlackDaoBondingCalculator(address(blkd));
        treasury = new BlackDaoTreasury(address(blkd), 1, address(authority));
        authority.pushVault(address(treasury), true);
        staking = new BlackDaoStaking(address(blkd), address(sblkd), address(gblkd), 8, 0, 0, address(authority));

        sblkd.initialize(address(staking), address(treasury));
        gblkd.migrate(address(staking), address(sblkd));

        bondDepository = new BlackDaoBondDepository(address(blkd), address(treasury), address(authority));

        teller = new BondTeller(address(bondDepository), address(staking), address(treasury), address(blkd), address(sblkd), address(authority));
        bondDepository.setTeller(address(teller));
    }

    // @dev Do not delete this!  Test driver generates paramters, so used to create our 'normal' tests
    //    function test_createBond_deposit(
    //    //        uint256 amount,
    //        bool capacityIsPayout,
    //        uint256 capacity)
    //    public {
    //        uint256 amount = 5 * 10 ** 16;
    //    uint256 blkdMintAmount = 10 * 10 ** 18;
    //        BlackDaoBondDepository.Terms memory terms = BlackDaoBondDepository.Terms({controlVariable : 2, fixedTerm : false, vestingTerm : 5, expiration : 6, conclusion : 6, minimumPrice : 10, maxPayout : 1, maxDebt : 10});
    //        uint256 initialDebt = 0;
    //
    //        try  this.createBond_deposit(amount, blkdMintAmount, capacityIsPayout, capacity, terms, initialDebt){
    //        } catch Error(string memory error) {
    ////            assertEq("SafeERC20: ERC20 operation did not succeed", error);
    //TODO use gnosis MockContract, this isn't a real error
    //        }
    //    }

    function test_createBond_mulDiv() public {
        BlackDaoBondDepository.Terms memory terms = BlackDaoBondDepository.Terms({
            controlVariable: 2,
            fixedTerm: false,
            vestingTerm: 5,
            expiration: 6,
            conclusion: 16,
            minimumPrice: 10,
            maxPayout: 1,
            maxDebt: 10
        });
        uint256 initialDebt = 0;
        uint256 blkdMintAmount = 10 * 10**18;
        try
            this.createBond_deposit(
                2763957476737854671246564045522737104576123858413359401,
                blkdMintAmount,
                false,
                9 * 10**20,
                terms,
                initialDebt,
                1 * 10**9
            )
        {
            fail();
        } catch Error(string memory error) {
            assertEq("FullMath: FULLDIV_OVERFLOW", error);
        }
    }

    function test_createBond_mulOverflow() public {
        BlackDaoBondDepository.Terms memory terms = BlackDaoBondDepository.Terms({
            controlVariable: 2,
            fixedTerm: false,
            vestingTerm: 5,
            expiration: 6,
            conclusion: 16,
            minimumPrice: 10,
            maxPayout: 1,
            maxDebt: 10
        });
        uint256 initialDebt = 0;
        uint256 blkdMintAmount = 10 * 10**18;
        try
            this.createBond_deposit(
                75002556493819725874826918455844256653204641352000021311689657671948594686325,
                blkdMintAmount,
                false,
                9 * 10**20,
                terms,
                initialDebt,
                1 * 10**9
            )
        {
            fail();
        } catch Error(string memory error) {
            assertEq("SafeMath: multiplication overflow", error);
        }
    }

    function test_createBond_fixedPointFractionOverflow() public {
        BlackDaoBondDepository.Terms memory terms = BlackDaoBondDepository.Terms({
            controlVariable: 2,
            fixedTerm: false,
            vestingTerm: 5,
            expiration: 6,
            conclusion: 16,
            minimumPrice: 10,
            maxPayout: 1,
            maxDebt: 10
        });
        uint256 initialDebt = 0;
        uint256 blkdMintAmount = 10 * 10**18;
        try
            this.createBond_deposit(
                5136935571488474593545398400365374838660649282530,
                blkdMintAmount,
                false,
                9 * 10**20,
                terms,
                initialDebt,
                1 * 10**9
            )
        {
            fail();
        } catch Error(string memory error) {
            assertEq("FixedPoint::fraction: overflow", error);
        }
    }

    function test_createBond_happyPath() public {
        BlackDaoBondDepository.Terms memory terms = BlackDaoBondDepository.Terms({
            controlVariable: 2,
            fixedTerm: false,
            vestingTerm: 5,
            expiration: 6,
            conclusion: 16,
            minimumPrice: 10,
            maxPayout: 10000,
            maxDebt: 10
        });
        uint256 initialDebt = 0;
        uint256 blkdMintAmount = 11 * 10**18;

        this.createBond_deposit(5 * 10**16, blkdMintAmount, false, 9 * 10**20, terms, initialDebt, 1 * 10**9);
    }

    function test_createBond_insufficientReserves() public {
        BlackDaoBondDepository.Terms memory terms = BlackDaoBondDepository.Terms({
            controlVariable: 2,
            fixedTerm: false,
            vestingTerm: 5,
            expiration: 6,
            conclusion: 16,
            minimumPrice: 10,
            maxPayout: 1 * 10**18,
            maxDebt: 10
        });
        uint256 initialDebt = 0;
        uint256 blkdMintAmount = 10 * 10**9;
        try this.createBond_deposit(5 * 10**16, blkdMintAmount, false, 9 * 10**20, terms, initialDebt, 1) {
            fail();
        } catch Error(string memory error) {
            assertEq("Treasury: insufficient reserves", error);
        }
    }

    function test_createBond_bondTooLarge() public {
        BlackDaoBondDepository.Terms memory terms = BlackDaoBondDepository.Terms({
            controlVariable: 2,
            fixedTerm: false,
            vestingTerm: 5,
            expiration: 6,
            conclusion: 16,
            minimumPrice: 10,
            maxPayout: 1 * 10**9,
            maxDebt: 10
        });
        uint256 initialDebt = 0;
        uint256 blkdMintAmount = 10 * 10**9;
        try this.createBond_deposit(5 * 10**16, blkdMintAmount, false, 9 * 10**20, terms, initialDebt, 1) {
            fail();
        } catch Error(string memory error) {
            assertEq("Bond too large", error);
        }
    }

    function test_createBond_zeroAmount() public {
        BlackDaoBondDepository.Terms memory terms = BlackDaoBondDepository.Terms({
            controlVariable: 2,
            fixedTerm: false,
            vestingTerm: 5,
            expiration: 6,
            conclusion: 16,
            minimumPrice: 10,
            maxPayout: 1,
            maxDebt: 10
        });
        uint256 initialDebt = 0;
        uint256 blkdMintAmount = 10 * 10**18;

        try this.createBond_deposit(0, blkdMintAmount, false, 9 * 10**20, terms, initialDebt, 1 * 10**9) {
            fail();
        } catch Error(string memory error) {
            assertEq("Bond too small", error);
        }
    }

    function test_createBond_bondConcluded() public {
        BlackDaoBondDepository.Terms memory terms = BlackDaoBondDepository.Terms({
            controlVariable: 2,
            fixedTerm: false,
            vestingTerm: 5,
            expiration: 6,
            conclusion: 2,
            minimumPrice: 10,
            maxPayout: 1,
            maxDebt: 10
        });
        uint256 initialDebt = 0;
        uint256 blkdMintAmount = 10 * 10**18;
        try this.createBond_deposit(5 * 10**25, blkdMintAmount, false, 1 * 10**20, terms, initialDebt, 1 * 10**9) {
            fail();
        } catch Error(string memory error) {
            assertEq("Bond concluded", error);
        }
    }

    function createBond_deposit(
        uint256 amount,
        uint256 treasuryDeposit,
        bool capacityIsPayout,
        uint256 capacity,
        BlackDaoBondDepository.Terms memory terms,
        uint256 initialDebt,
        uint256 profit
    ) external {
        //        log_named_uint("amount", amount);
        //        log_named_uint("blkdMintAmount", treasuryDeposit);
        //        log_named_uint("capacityIsPayout", capacityIsPayout ? 1 : 0);
        //        log_named_uint("capacity", capacity);

        //        blkd.mint(address(this), blkdMintAmount);
        // treasury.enableOnChainGovernance();
        uint256 currentBlock = 8;
        hevm.roll(currentBlock);
        //7 day timelock TODO add test where it's not long enough
        // Timelock is disabled before initializtion
        treasury.enable(BlackDaoTreasury.STATUS.REWARDMANAGER, address(teller), address(bondingCalculator));

        treasury.enable(BlackDaoTreasury.STATUS.RESERVETOKEN, address(abcToken), address(bondingCalculator));
        treasury.enable(BlackDaoTreasury.STATUS.RESERVEDEPOSITOR, address(this), address(bondingCalculator));
        treasury.initialize();

        abcToken.givenMethodReturnBool(abi.encodeWithSelector(IERC20.transferFrom.selector), true);

        treasury.deposit(treasuryDeposit, address(abcToken), profit);

        MockContract pair = new MockContract();
        // TODO this one is wild:  error StateChangeWhileStatic unless
        // we comment out MockContract's call to abi.encodeWithSignature("updateInvocationCount(bytes4,bytes)"
        pair.givenMethodReturnBool(abi.encodeWithSelector(IERC20.transfer.selector), true);

        pair.givenMethodReturn(abi.encodeWithSelector(ERC20.name.selector), abi.encode("MockUniswapPair"));
        pair.givenMethodReturn(abi.encodeWithSelector(ERC20.symbol.selector), abi.encode("MOCK"));
        pair.givenMethodReturnUint(abi.encodeWithSelector(ERC20.decimals.selector), 18);

        pair.givenMethodReturnAddress(abi.encodeWithSelector(IUniswapV2Pair.token0.selector), address(blkd));
        pair.givenMethodReturnAddress(abi.encodeWithSelector(IUniswapV2Pair.token1.selector), address(abcToken));
        pair.givenMethodReturn(
            abi.encodeWithSelector(IUniswapV2Pair.getReserves.selector),
            abi.encode(uint112(5 * 10**9), uint112(10 * 10**9), uint32(0))
        );

        uint256 bondId = bondDepository.addBond(address(pair), address(bondingCalculator), capacity, capacityIsPayout);
        bondDepository.setTerms(
            bondId,
            terms.controlVariable,
            terms.fixedTerm,
            terms.vestingTerm,
            terms.expiration,
            terms.conclusion,
            terms.minimumPrice,
            terms.maxPayout,
            terms.maxDebt,
            initialDebt
        );

        address depositor = address(0x1);
        address feo = address(0x2);

        (uint256 payout, uint256 index) = bondDepository.deposit(amount, 200, depositor, bondId, feo);
        assertEq(5 * 10**7, payout);
        assertEq(0, index);

        (address principal, address calculator, uint256 totalDebt, uint256 lastBondCreatedAt) = bondDepository.bondInfo(bondId);

        assertEq(address(pair), principal);
        assertEq(address(bondingCalculator), calculator);
        assertEq(payout, totalDebt);
        assertEq(currentBlock, lastBondCreatedAt);

        assertEq(1_005_000_000, bondDepository.maxPayout(bondId));
        assertEq(100_000_000_000_000_012_105, bondDepository.payoutFor(1 * 10**20, bondId));
        assertEq(1 * 10**11, bondDepository.payoutForAmount(1 * 10**20, bondId));

        assertEq(100, bondDepository.bondPrice(bondId));
        assertEq(44_721_519_100_560, bondDepository.bondPriceInUSD(bondId));
        assertEq(4_975_124, bondDepository.debtRatio(bondId));
        assertEq(222_495_102_993, bondDepository.standardizedDebtRatio(bondId));
        assertEq(payout, bondDepository.currentDebt(bondId));
    }
}
