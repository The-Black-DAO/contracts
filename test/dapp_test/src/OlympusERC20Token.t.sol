// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.7.5;

import "ds-test/test.sol"; // ds-test
import "../../../contracts/BlackDaoERC20.sol";

import "../../../contracts/BlackDaoAuthority.sol";


contract OlymppusERC20TokenTest is DSTest {
    BlackDaoERC20Token internal blkdContract;

    IBlackDaoAuthority internal authority;

    address internal UNAUTHORIZED_USER = address(0x1);


    function test_erc20() public {
        authority = new BlackDaoAuthority(address(this), address(this), address(this), address(this));
        blkdContract = new BlackDaoERC20Token(address(authority));
        assertEq("BlackDao", blkdContract.name());
        assertEq("BLKD", blkdContract.symbol());
        assertEq(9, int(blkdContract.decimals()));
    }

    function testCannot_mint() public {
        authority = new BlackDaoAuthority(address(this), address(this), address(this), UNAUTHORIZED_USER);
        blkdContract = new BlackDaoERC20Token(address(authority));
        // try/catch block pattern copied from https://github.com/Anish-Agnihotri/MultiRaffle/blob/master/src/test/utils/DSTestExtended.sol
        try blkdContract.mint(address(this), 100) {
            fail();
        } catch Error(string memory error) {
            // Assert revert error matches expected message
            assertEq("UNAUTHORIZED", error);
        }
    }

    // Tester will pass it's own parameters, see https://fv.ethereum.org/2020/12/11/symbolic-execution-with-ds-test/
    function test_mint(uint256 amount) public {
        authority = new BlackDaoAuthority(address(this), address(this), address(this), address(this));
        blkdContract = new BlackDaoERC20Token(address(authority));
        uint256 supplyBefore = blkdContract.totalSupply();
         // TODO look into https://dapphub.chat/channel/dev?msg=HWrPJqxp8BHMiKTbo
        // blkdContract.setVault(address(this)); //TODO WTF msg.sender doesn't propigate from .dapprc $DAPP_TEST_CALLER config via mint() call, must use this value
        blkdContract.mint(address(this), amount);
        assertEq(supplyBefore + amount, blkdContract.totalSupply());
    }

    // Tester will pass it's own parameters, see https://fv.ethereum.org/2020/12/11/symbolic-execution-with-ds-test/
    function test_burn(uint256 mintAmount, uint256 burnAmount) public {
        authority = new BlackDaoAuthority(address(this), address(this), address(this), address(this));
        blkdContract = new BlackDaoERC20Token(address(authority));
        uint256 supplyBefore = blkdContract.totalSupply();
        // blkdContract.setVault(address(this));  //TODO WTF msg.sender doesn't propigate from .dapprc $DAPP_TEST_CALLER config via mint() call, must use this value
        blkdContract.mint(address(this), mintAmount);
        if (burnAmount <= mintAmount){
            blkdContract.burn(burnAmount);
            assertEq(supplyBefore + mintAmount - burnAmount, blkdContract.totalSupply());
        } else {
            try blkdContract.burn(burnAmount) {
                fail();
            } catch Error(string memory error) {
                // Assert revert error matches expected message
                assertEq("ERC20: burn amount exceeds balance", error);
            }
        }
    }
}