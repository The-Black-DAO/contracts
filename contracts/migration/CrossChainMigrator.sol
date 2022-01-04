// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.7.5;

import "../interfaces/IERC20.sol";
import "../interfaces/IOwnable.sol";
import "../types/Ownable.sol";
import "../libraries/SafeERC20.sol";

contract CrossChainMigrator is Ownable {
    using SafeERC20 for IERC20;

    IERC20 internal immutable wsBLKD; // v1 token
    IERC20 internal immutable gBLKD; // v2 token

    constructor(address _wsBLKD, address _gBLKD) {
        require(_wsBLKD != address(0), "Zero address: wsBLKD");
        wsBLKD = IERC20(_wsBLKD);
        require(_gBLKD != address(0), "Zero address: gBLKD");
        gBLKD = IERC20(_gBLKD);
    }

    // migrate wsBLKD to gBLKD - 1:1 like kind
    function migrate(uint256 amount) external {
        wsBLKD.safeTransferFrom(msg.sender, address(this), amount);
        gBLKD.safeTransfer(msg.sender, amount);
    }

    // withdraw wsBLKD so it can be bridged on ETH and returned as more gBLKD
    function replenish() external onlyOwner {
        wsBLKD.safeTransfer(msg.sender, wsBLKD.balanceOf(address(this)));
    }

    // withdraw migrated wsBLKD and unmigrated gBLKD
    function clear() external onlyOwner {
        wsBLKD.safeTransfer(msg.sender, wsBLKD.balanceOf(address(this)));
        gBLKD.safeTransfer(msg.sender, gBLKD.balanceOf(address(this)));
    }
}