// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.7.5;

import "../interfaces/IERC20.sol";
import "../interfaces/IsBLKD.sol";
import "../interfaces/IwsBLKD.sol";
import "../interfaces/IgBLKD.sol";
import "../interfaces/ITreasury.sol";
import "../interfaces/IStaking.sol";
import "../interfaces/IOwnable.sol";
import "../interfaces/IUniswapV2Router.sol";
import "../interfaces/IStakingV1.sol";
import "../interfaces/ITreasuryV1.sol";

import "../types/BlackDaoAccessControlled.sol";

import "../libraries/SafeMath.sol";
import "../libraries/SafeERC20.sol";


contract BlackDaoTokenMigrator is BlackDaoAccessControlled {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;
    using SafeERC20 for IgBLKD;
    using SafeERC20 for IsBLKD;
    using SafeERC20 for IwsBLKD;

    /* ========== MIGRATION ========== */

    event TimelockStarted(uint256 block, uint256 end);
    event Migrated(address staking, address treasury);
    event Funded(uint256 amount);
    event Defunded(uint256 amount);

    /* ========== STATE VARIABLES ========== */

    IERC20 public immutable oldBLKD;
    IsBLKD public immutable oldsBLKD;
    IwsBLKD public immutable oldwsBLKD;
    ITreasuryV1 public immutable oldTreasury;
    IStakingV1 public immutable oldStaking;

    IUniswapV2Router public immutable sushiRouter;
    IUniswapV2Router public immutable uniRouter;

    IgBLKD public gBLKD;
    ITreasury public newTreasury;
    IStaking public newStaking;
    IERC20 public newBLKD;

    bool public blkdMigrated;
    bool public shutdown;

    uint256 public immutable timelockLength;
    uint256 public timelockEnd;

    uint256 public oldSupply;

    constructor(
        address _oldBLKD,
        address _oldsBLKD,
        address _oldTreasury,
        address _oldStaking,
        address _oldwsBLKD,
        address _sushi,
        address _uni,
        uint256 _timelock,
        address _authority
    ) BlackDaoAccessControlled(IBlackDaoAuthority(_authority)) {
        require(_oldBLKD != address(0), "Zero address: BLKD");
        oldBLKD = IERC20(_oldBLKD);
        require(_oldsBLKD != address(0), "Zero address: sBLKD");
        oldsBLKD = IsBLKD(_oldsBLKD);
        require(_oldTreasury != address(0), "Zero address: Treasury");
        oldTreasury = ITreasuryV1(_oldTreasury);
        require(_oldStaking != address(0), "Zero address: Staking");
        oldStaking = IStakingV1(_oldStaking);
        require(_oldwsBLKD != address(0), "Zero address: wsBLKD");
        oldwsBLKD = IwsBLKD(_oldwsBLKD);
        require(_sushi != address(0), "Zero address: Sushi");
        sushiRouter = IUniswapV2Router(_sushi);
        require(_uni != address(0), "Zero address: Uni");
        uniRouter = IUniswapV2Router(_uni);
        timelockLength = _timelock;
    }

    /* ========== MIGRATION ========== */

    enum TYPE {
        UNSTAKED,
        STAKED,
        WRAPPED
    }

    // migrate BLKDv1, sBLKDv1, or wsBLKD for BLKDv2, sBLKDv2, or gBLKD
    function migrate(
        uint256 _amount,
        TYPE _from,
        TYPE _to
    ) external {
        require(!shutdown, "Shut down");

        uint256 wAmount = oldwsBLKD.sBLKDTowBLKD(_amount);

        if (_from == TYPE.UNSTAKED) {
            require(blkdMigrated, "Only staked until migration");
            oldBLKD.safeTransferFrom(msg.sender, address(this), _amount);
        } else if (_from == TYPE.STAKED) {
            oldsBLKD.safeTransferFrom(msg.sender, address(this), _amount);
        } else {
            oldwsBLKD.safeTransferFrom(msg.sender, address(this), _amount);
            wAmount = _amount;
        }

        if (blkdMigrated) {
            require(oldSupply >= oldBLKD.totalSupply(), "BLKDv1 minted");
            _send(wAmount, _to);
        } else {
            gBLKD.mint(msg.sender, wAmount);
        }
    }

    // migrate all black tokens held
    function migrateAll(TYPE _to) external {
        require(!shutdown, "Shut down");

        uint256 blkdBal = 0;
        uint256 sBLKDBal = oldsBLKD.balanceOf(msg.sender);
        uint256 wsBLKDBal = oldwsBLKD.balanceOf(msg.sender);

        if (oldBLKD.balanceOf(msg.sender) > 0 && blkdMigrated) {
            blkdBal = oldBLKD.balanceOf(msg.sender);
            oldBLKD.safeTransferFrom(msg.sender, address(this), blkdBal);
        }
        if (sBLKDBal > 0) {
            oldsBLKD.safeTransferFrom(msg.sender, address(this), sBLKDBal);
        }
        if (wsBLKDBal > 0) {
            oldwsBLKD.safeTransferFrom(msg.sender, address(this), wsBLKDBal);
        }

        uint256 wAmount = wsBLKDBal.add(oldwsBLKD.sBLKDTowBLKD(blkdBal.add(sBLKDBal)));
        if (blkdMigrated) {
            require(oldSupply >= oldBLKD.totalSupply(), "BLKDv1 minted");
            _send(wAmount, _to);
        } else {
            gBLKD.mint(msg.sender, wAmount);
        }
    }

    // send preferred token
    function _send(uint256 wAmount, TYPE _to) internal {
        if (_to == TYPE.WRAPPED) {
            gBLKD.safeTransfer(msg.sender, wAmount);
        } else if (_to == TYPE.STAKED) {
            newStaking.unwrap(msg.sender, wAmount);
        } else if (_to == TYPE.UNSTAKED) {
            newStaking.unstake(msg.sender, wAmount, false, false);
        }
    }

    // bridge back to BLKD, sBLKD, or wsBLKD
    function bridgeBack(uint256 _amount, TYPE _to) external {
        if (!blkdMigrated) {
            gBLKD.burn(msg.sender, _amount);
        } else {
            gBLKD.safeTransferFrom(msg.sender, address(this), _amount);
        }

        uint256 amount = oldwsBLKD.wBLKDTosBLKD(_amount);
        // error throws if contract does not have enough of type to send
        if (_to == TYPE.UNSTAKED) {
            oldBLKD.safeTransfer(msg.sender, amount);
        } else if (_to == TYPE.STAKED) {
            oldsBLKD.safeTransfer(msg.sender, amount);
        } else if (_to == TYPE.WRAPPED) {
            oldwsBLKD.safeTransfer(msg.sender, _amount);
        }
    }

    /* ========== OWNABLE ========== */

    // halt migrations (but not bridging back)
    function halt() external onlyPolicy {
        require(!blkdMigrated, "Migration has occurred");
        shutdown = !shutdown;
    }

    // withdraw backing of migrated BLKD
    function defund(address reserve) external onlyGovernor {
        require(blkdMigrated, "Migration has not begun");
        require(timelockEnd < block.number && timelockEnd != 0, "Timelock not complete");

        oldwsBLKD.unwrap(oldwsBLKD.balanceOf(address(this)));

        uint256 amountToUnstake = oldsBLKD.balanceOf(address(this));
        oldsBLKD.approve(address(oldStaking), amountToUnstake);
        oldStaking.unstake(amountToUnstake, false);

        uint256 balance = oldBLKD.balanceOf(address(this));

        if(balance > oldSupply) {
            oldSupply = 0;
        } else {
            oldSupply -= balance;
        }

        uint256 amountToWithdraw = balance.mul(1e9);
        oldBLKD.approve(address(oldTreasury), amountToWithdraw);
        oldTreasury.withdraw(amountToWithdraw, reserve);
        IERC20(reserve).safeTransfer(address(newTreasury), IERC20(reserve).balanceOf(address(this)));

        emit Defunded(balance);
    }

    // start timelock to send backing to new treasury
    function startTimelock() external onlyGovernor {
        require(timelockEnd == 0, "Timelock set");
        timelockEnd = block.number.add(timelockLength);

        emit TimelockStarted(block.number, timelockEnd);
    }

    // set gBLKD address
    function setgBLKD(address _gBLKD) external onlyGovernor {
        require(address(gBLKD) == address(0), "Already set");
        require(_gBLKD != address(0), "Zero address: gBLKD");

        gBLKD = IgBLKD(_gBLKD);
    }

    // call internal migrate token function
    function migrateToken(address token) external onlyGovernor {
        _migrateToken(token, false);
    }

    /**
     *   @notice Migrate LP and pair with new BLKD
     */
    function migrateLP(
        address pair,
        bool sushi,
        address token,
        uint256 _minA,
        uint256 _minB
    ) external onlyGovernor {
        uint256 oldLPAmount = IERC20(pair).balanceOf(address(oldTreasury));
        oldTreasury.manage(pair, oldLPAmount);

        IUniswapV2Router router = sushiRouter;
        if (!sushi) {
            router = uniRouter;
        }

        IERC20(pair).approve(address(router), oldLPAmount);
        (uint256 amountA, uint256 amountB) = router.removeLiquidity(
            token, 
            address(oldBLKD), 
            oldLPAmount,
            _minA, 
            _minB, 
            address(this), 
            block.timestamp
        );

        newTreasury.mint(address(this), amountB);

        IERC20(token).approve(address(router), amountA);
        newBLKD.approve(address(router), amountB);

        router.addLiquidity(
            token, 
            address(newBLKD), 
            amountA, 
            amountB, 
            amountA, 
            amountB, 
            address(newTreasury), 
            block.timestamp
        );
    }

    // Failsafe function to allow owner to withdraw funds sent directly to contract in case someone sends non-blkd tokens to the contract
    function withdrawToken(
        address tokenAddress,
        uint256 amount,
        address recipient
    ) external onlyGovernor {
        require(tokenAddress != address(0), "Token address cannot be 0x0");
        require(tokenAddress != address(gBLKD), "Cannot withdraw: gBLKD");
        require(tokenAddress != address(oldBLKD), "Cannot withdraw: old-BLKD");
        require(tokenAddress != address(oldsBLKD), "Cannot withdraw: old-sBLKD");
        require(tokenAddress != address(oldwsBLKD), "Cannot withdraw: old-wsBLKD");
        require(amount > 0, "Withdraw value must be greater than 0");
        if (recipient == address(0)) {
            recipient = msg.sender; // if no address is specified the value will will be withdrawn to Owner
        }

        IERC20 tokenContract = IERC20(tokenAddress);
        uint256 contractBalance = tokenContract.balanceOf(address(this));
        if (amount > contractBalance) {
            amount = contractBalance; // set the withdrawal amount equal to balance within the account.
        }
        // transfer the token from address of this contract
        tokenContract.safeTransfer(recipient, amount);
    }

    // migrate contracts
    function migrateContracts(
        address _newTreasury,
        address _newStaking,
        address _newBLKD,
        address _newsBLKD,
        address _reserve
    ) external onlyGovernor {
        require(!blkdMigrated, "Already migrated");
        blkdMigrated = true;
        shutdown = false;

        require(_newTreasury != address(0), "Zero address: Treasury");
        newTreasury = ITreasury(_newTreasury);
        require(_newStaking != address(0), "Zero address: Staking");
        newStaking = IStaking(_newStaking);
        require(_newBLKD != address(0), "Zero address: BLKD");
        newBLKD = IERC20(_newBLKD);

        oldSupply = oldBLKD.totalSupply(); // log total supply at time of migration

        gBLKD.migrate(_newStaking, _newsBLKD); // change gBLKD minter

        _migrateToken(_reserve, true); // will deposit tokens into new treasury so reserves can be accounted for

        _fund(oldsBLKD.circulatingSupply()); // fund with current staked supply for token migration

        emit Migrated(_newStaking, _newTreasury);
    }

    /* ========== INTERNAL FUNCTIONS ========== */

    // fund contract with gBLKD
    function _fund(uint256 _amount) internal {
        newTreasury.mint(address(this), _amount);
        newBLKD.approve(address(newStaking), _amount);
        newStaking.stake(address(this), _amount, false, true); // stake and claim gBLKD

        emit Funded(_amount);
    }

    /**
     *   @notice Migrate token from old treasury to new treasury
     */
    function _migrateToken(address token, bool deposit) internal {
        uint256 balance = IERC20(token).balanceOf(address(oldTreasury));

        uint256 excessReserves = oldTreasury.excessReserves();
        uint256 tokenValue = oldTreasury.valueOf(token, balance);

        if (tokenValue > excessReserves) {
            tokenValue = excessReserves;
            balance = excessReserves * 10**9;
        }

        oldTreasury.manage(token, balance);

        if (deposit) {
            IERC20(token).safeApprove(address(newTreasury), balance);
            newTreasury.deposit(balance, token, tokenValue);
        } else {
            IERC20(token).safeTransfer(address(newTreasury), balance);
        }
    }
}
