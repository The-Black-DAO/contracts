// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.7.5;

import "../interfaces/IERC20.sol";
import "../types/Ownable.sol";

contract BlkdFaucet is Ownable {
    IERC20 public blkd;

    constructor(address _blkd) {
        blkd = IERC20(_blkd);
    }

    function setBlkd(address _blkd) external onlyOwner {
        blkd = IERC20(_blkd);
    }

    function dispense() external {
        blkd.transfer(msg.sender, 1e9);
    }
}
