// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.7.5;
pragma abicoder v2;

import "ds-test/test.sol"; // ds-test

import "../../../contracts/libraries/SafeMath.sol";
import "../../../contracts/libraries/FixedPoint.sol";
import "../../../contracts/libraries/FullMath.sol";
import "../../../contracts/Staking.sol";
import "../../../contracts/BlackDaoERC20.sol";
import "../../../contracts/sBlackDaoERC20.sol";
import "../../../contracts/governance/gBLKD.sol";
import "../../../contracts/Treasury.sol";
import "../../../contracts/StakingDistributor.sol";
import "../../../contracts/BlackDaoAuthority.sol";

import "./util/Hevm.sol";
import "./util/MockContract.sol";

contract StakingTest is DSTest {
    using FixedPoint for *;
    using SafeMath for uint256;
    using SafeMath for uint112;

    BlackDaoStaking internal staking;
    BlackDaoTreasury internal treasury;
    BlackDaoAuthority internal authority;
    Distributor internal distributor;

    BlackDaoERC20Token internal blkd;
    sBlackDao internal sblkd;
    gBLKD internal gblkd;

    MockContract internal mockToken;

    /// @dev Hevm setup
    Hevm internal constant hevm = Hevm(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);
    uint256 internal constant AMOUNT = 1000;
    uint256 internal constant EPOCH_LENGTH = 8; // In Seconds
    uint256 internal constant START_TIME = 0; // Starting at this epoch
    uint256 internal constant NEXT_REBASE_TIME = 1; // Next epoch is here
    uint256 internal constant BOUNTY = 42;

    function setUp() public {
        // Start at timestamp
        hevm.warp(START_TIME);

        // Setup mockToken to deposit into treasury (for excess reserves)
        mockToken = new MockContract();
        mockToken.givenMethodReturn(abi.encodeWithSelector(ERC20.name.selector), abi.encode("mock DAO"));
        mockToken.givenMethodReturn(abi.encodeWithSelector(ERC20.symbol.selector), abi.encode("MOCK"));
        mockToken.givenMethodReturnUint(abi.encodeWithSelector(ERC20.decimals.selector), 18);
        mockToken.givenMethodReturnBool(abi.encodeWithSelector(IERC20.transferFrom.selector), true);

        authority = new BlackDaoAuthority(address(this), address(this), address(this), address(this));

        blkd = new BlackDaoERC20Token(address(authority));
        gblkd = new gBLKD(address(this), address(this));
        sblkd = new sBlackDao();
        sblkd.setIndex(10);
        sblkd.setgBLKD(address(gblkd));

        treasury = new BlackDaoTreasury(address(blkd), 1, address(authority));

        staking = new BlackDaoStaking(
            address(blkd),
            address(sblkd),
            address(gblkd),
            EPOCH_LENGTH,
            START_TIME,
            NEXT_REBASE_TIME,
            address(authority)
        );

        distributor = new Distributor(address(treasury), address(blkd), address(staking), address(authority));
        distributor.setBounty(BOUNTY);
        staking.setDistributor(address(distributor));
        treasury.enable(BlackDaoTreasury.STATUS.REWARDMANAGER, address(distributor), address(0)); // Allows distributor to mint blkd.
        treasury.enable(BlackDaoTreasury.STATUS.RESERVETOKEN, address(mockToken), address(0)); // Allow mock token to be deposited into treasury
        treasury.enable(BlackDaoTreasury.STATUS.RESERVEDEPOSITOR, address(this), address(0)); // Allow this contract to deposit token into treeasury

        sblkd.initialize(address(staking), address(treasury));
        gblkd.migrate(address(staking), address(sblkd));

        // Give the treasury permissions to mint
        authority.pushVault(address(treasury), true);

        // Deposit a token who's profit (3rd param) determines how much blkd the treasury can mint
        uint256 depositAmount = 20e18;
        treasury.deposit(depositAmount, address(mockToken), BOUNTY.mul(2)); // Mints (depositAmount- 2xBounty) for this contract
    }

    function testStakeNoBalance() public {
        uint256 newAmount = AMOUNT.mul(2);
        try staking.stake(address(this), newAmount, true, true) {
            fail();
        } catch Error(string memory error) {
            assertEq(error, "TRANSFER_FROM_FAILED"); // Should be 'Transfer exceeds balance'
        }
    }

    function testStakeWithoutAllowance() public {
        try staking.stake(address(this), AMOUNT, true, true) {
            fail();
        } catch Error(string memory error) {
            assertEq(error, "TRANSFER_FROM_FAILED"); // Should be 'Transfer exceeds allowance'
        }
    }

    function testStake() public {
        blkd.approve(address(staking), AMOUNT);
        uint256 amountStaked = staking.stake(address(this), AMOUNT, true, true);
        assertEq(amountStaked, AMOUNT);
    }

    function testStakeAtRebaseToGblkd() public {
        // Move into next rebase window
        hevm.warp(EPOCH_LENGTH);

        blkd.approve(address(staking), AMOUNT);
        bool isSblkd = false;
        bool claim = true;
        uint256 gBLKDRecieved = staking.stake(address(this), AMOUNT, isSblkd, claim);

        uint256 expectedAmount = gblkd.balanceTo(AMOUNT.add(BOUNTY));
        assertEq(gBLKDRecieved, expectedAmount);
    }

    function testStakeAtRebase() public {
        // Move into next rebase window
        hevm.warp(EPOCH_LENGTH);

        blkd.approve(address(staking), AMOUNT);
        bool isSblkd = true;
        bool claim = true;
        uint256 amountStaked = staking.stake(address(this), AMOUNT, isSblkd, claim);

        uint256 expectedAmount = AMOUNT.add(BOUNTY);
        assertEq(amountStaked, expectedAmount);
    }

    function testUnstake() public {
        bool triggerRebase = true;
        bool isSblkd = true;
        bool claim = true;

        // Stake the blkd
        uint256 initialBlkdBalance = blkd.balanceOf(address(this));
        blkd.approve(address(staking), initialBlkdBalance);
        uint256 amountStaked = staking.stake(address(this), initialBlkdBalance, isSblkd, claim);
        assertEq(amountStaked, initialBlkdBalance);

        // Validate balances post stake
        uint256 blkdBalance = blkd.balanceOf(address(this));
        uint256 sBlkdBalance = sblkd.balanceOf(address(this));
        assertEq(blkdBalance, 0);
        assertEq(sBlkdBalance, initialBlkdBalance);

        // Unstake sBLKD
        sblkd.approve(address(staking), sBlkdBalance);
        staking.unstake(address(this), sBlkdBalance, triggerRebase, isSblkd);

        // Validate Balances post unstake
        blkdBalance = blkd.balanceOf(address(this));
        sBlkdBalance = sblkd.balanceOf(address(this));
        assertEq(blkdBalance, initialBlkdBalance);
        assertEq(sBlkdBalance, 0);
    }

    function testUnstakeAtRebase() public {
        bool triggerRebase = true;
        bool isSblkd = true;
        bool claim = true;

        // Stake the blkd
        uint256 initialBlkdBalance = blkd.balanceOf(address(this));
        blkd.approve(address(staking), initialBlkdBalance);
        uint256 amountStaked = staking.stake(address(this), initialBlkdBalance, isSblkd, claim);
        assertEq(amountStaked, initialBlkdBalance);

        // Move into next rebase window
        hevm.warp(EPOCH_LENGTH);

        // Validate balances post stake
        // Post initial rebase, distribution amount is 0, so sBLKD balance doens't change.
        uint256 blkdBalance = blkd.balanceOf(address(this));
        uint256 sBlkdBalance = sblkd.balanceOf(address(this));
        assertEq(blkdBalance, 0);
        assertEq(sBlkdBalance, initialBlkdBalance);

        // Unstake sBLKD
        sblkd.approve(address(staking), sBlkdBalance);
        staking.unstake(address(this), sBlkdBalance, triggerRebase, isSblkd);

        // Validate balances post unstake
        blkdBalance = blkd.balanceOf(address(this));
        sBlkdBalance = sblkd.balanceOf(address(this));
        uint256 expectedAmount = initialBlkdBalance.add(BOUNTY); // Rebase earns a bounty
        assertEq(blkdBalance, expectedAmount);
        assertEq(sBlkdBalance, 0);
    }

    function testUnstakeAtRebaseFromGblkd() public {
        bool triggerRebase = true;
        bool isSblkd = false;
        bool claim = true;

        // Stake the blkd
        uint256 initialBlkdBalance = blkd.balanceOf(address(this));
        blkd.approve(address(staking), initialBlkdBalance);
        uint256 amountStaked = staking.stake(address(this), initialBlkdBalance, isSblkd, claim);
        uint256 gblkdAmount = gblkd.balanceTo(initialBlkdBalance);
        assertEq(amountStaked, gblkdAmount);

        // test the unstake
        // Move into next rebase window
        hevm.warp(EPOCH_LENGTH);

        // Validate balances post-stake
        uint256 blkdBalance = blkd.balanceOf(address(this));
        uint256 gblkdBalance = gblkd.balanceOf(address(this));
        assertEq(blkdBalance, 0);
        assertEq(gblkdBalance, gblkdAmount);

        // Unstake gBLKD
        gblkd.approve(address(staking), gblkdBalance);
        staking.unstake(address(this), gblkdBalance, triggerRebase, isSblkd);

        // Validate balances post unstake
        blkdBalance = blkd.balanceOf(address(this));
        gblkdBalance = gblkd.balanceOf(address(this));
        uint256 expectedBlkd = initialBlkdBalance.add(BOUNTY); // Rebase earns a bounty
        assertEq(blkdBalance, expectedBlkd);
        assertEq(gblkdBalance, 0);
    }
}
