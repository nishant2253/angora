// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import 'forge-std/Test.sol';
import '../contracts/MockUSDT.sol';
import '../contracts/MockDEX.sol';

contract MockDEXTest is Test {
    MockUSDT usdt;
    MockDEX dex;
    address trader = makeAddr('trader');

    function setUp() public {
        usdt = new MockUSDT();
        dex = new MockDEX(address(usdt));

        // Seed DEX with USDT liquidity
        usdt.transfer(address(dex), 500_000 * 10 ** 6);

        // Seed DEX with MON liquidity
        dex.fundMON{value: 1000 ether}();
    }

    // ── sellMON ─────────────────────────────────────────────────────────────

    function test_sellMON_emitsSwap() public {
        vm.deal(trader, 1 ether);

        vm.prank(trader);
        vm.expectEmit(true, true, false, false);
        emit MockDEX.Swap('agent-1', trader, 'SELL_MON', 0, 0);
        dex.sellMON{value: 1 ether}('agent-1', 0);
    }

    function test_sellMON_transfersUSDT() public {
        vm.deal(trader, 1 ether);

        uint256 balBefore = usdt.balanceOf(trader);

        vm.prank(trader);
        dex.sellMON{value: 1 ether}('agent-1', 0);

        uint256 balAfter = usdt.balanceOf(trader);
        // 1 MON = 20 mUSDT (6 decimals)
        assertEq(balAfter - balBefore, 20 * 10 ** 6);
    }

    function test_sellMON_revert_ZeroAmount() public {
        vm.deal(trader, 1 ether);
        vm.prank(trader);
        vm.expectRevert(MockDEX.ZeroAmount.selector);
        dex.sellMON{value: 0}('agent-1', 0);
    }

    function test_sellMON_revert_InsufficientLiquidity() public {
        // Drain all USDT from DEX first
        dex.withdrawUSDT(usdt.balanceOf(address(dex)));

        vm.deal(trader, 1 ether);
        vm.prank(trader);
        vm.expectRevert(MockDEX.InsufficientLiquidity.selector);
        dex.sellMON{value: 1 ether}('agent-1', 0);
    }

    // ── buyMON ──────────────────────────────────────────────────────────────

    function test_buyMON_transfersMON() public {
        // Give trader mUSDT
        usdt.faucet(trader, 100 * 10 ** 6); // 100 mUSDT

        vm.startPrank(trader);
        usdt.approve(address(dex), 100 * 10 ** 6);

        uint256 monBefore = trader.balance;
        dex.buyMON('agent-2', 20 * 10 ** 6, 0); // buy with 20 mUSDT → 1 MON
        vm.stopPrank();

        assertEq(trader.balance - monBefore, 1 ether);
    }

    function test_buyMON_revert_ZeroAmount() public {
        vm.prank(trader);
        vm.expectRevert(MockDEX.ZeroAmount.selector);
        dex.buyMON('agent-2', 0, 0);
    }

    // ── fundMON ─────────────────────────────────────────────────────────────

    function test_fundMON_addsBalance() public {
        uint256 before = address(dex).balance;
        dex.fundMON{value: 5 ether}();
        assertEq(address(dex).balance - before, 5 ether);
    }

    function test_fundMON_revert_ZeroAmount() public {
        vm.expectRevert(MockDEX.ZeroAmount.selector);
        dex.fundMON{value: 0}();
    }

    // ── MockUSDT faucet ──────────────────────────────────────────────────────

    function test_faucet_mintsUSDT() public {
        uint256 before = usdt.balanceOf(trader);
        usdt.faucet(trader, 1000 * 10 ** 6);
        assertEq(usdt.balanceOf(trader) - before, 1000 * 10 ** 6);
    }

    function test_faucet_revert_MaxFaucetExceeded() public {
        vm.expectRevert(MockUSDT.MaxFaucetExceeded.selector);
        usdt.faucet(trader, 10_001 * 10 ** 6);
    }
}
