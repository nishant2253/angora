// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import 'forge-std/Test.sol';
import '../contracts/AgentRegistry.sol';

contract AgentRegistryTest is Test {
    AgentRegistry reg;
    address user = makeAddr('user');
    address user2 = makeAddr('user2');

    function setUp() public {
        reg = new AgentRegistry();
    }

    // ── Happy path ──────────────────────────────────────────────────────────

    function test_registerAgent() public {
        vm.prank(user);
        reg.registerAgent('agent-1', keccak256('cfg'), 'TREND_FOLLOW');

        (
            string memory id,
            address owner,
            bytes32 cfgHash,
            string memory strategy,
            uint256 deployedAt,
            bool active
        ) = reg.agents('agent-1');

        assertEq(id, 'agent-1');
        assertEq(owner, user);
        assertEq(cfgHash, keccak256('cfg'));
        assertEq(strategy, 'TREND_FOLLOW');
        assertGt(deployedAt, 0);
        assertTrue(active);
    }

    function test_ownerAgentsTracked() public {
        vm.startPrank(user);
        reg.registerAgent('a1', keccak256('c1'), 'MOMENTUM');
        reg.registerAgent('a2', keccak256('c2'), 'BREAKOUT');
        vm.stopPrank();

        string[] memory ids = reg.getOwnerAgents(user);
        assertEq(ids.length, 2);
        assertEq(ids[0], 'a1');
        assertEq(ids[1], 'a2');
    }

    function test_emitsAgentRegistered() public {
        vm.prank(user);
        vm.expectEmit(true, true, false, true);
        emit AgentRegistry.AgentRegistered('agent-e', user, 'MEAN_REVERT');
        reg.registerAgent('agent-e', keccak256('cfg'), 'MEAN_REVERT');
    }

    function test_logExecution_emitsEvent() public {
        vm.prank(user);
        reg.registerAgent('agent-x', keccak256('cfg'), 'MOMENTUM');

        vm.expectEmit(true, false, false, false);
        emit AgentRegistry.AgentExecuted('agent-x', 'BUY', 2000e8, 0);
        reg.logExecution('agent-x', 'BUY', 2000e8);
    }

    // ── Reverts ──────────────────────────────────────────────────────────────

    function test_revert_AlreadyRegistered() public {
        vm.prank(user);
        reg.registerAgent('a', keccak256('c'), 'MOMENTUM');

        vm.expectRevert(
            abi.encodeWithSelector(AgentRegistry.AlreadyRegistered.selector, 'a')
        );
        reg.registerAgent('a', keccak256('c'), 'MOMENTUM');
    }

    function test_revert_logExecution_AgentInactive() public {
        vm.prank(user);
        reg.registerAgent('agent-d', keccak256('cfg'), 'BREAKOUT');

        vm.prank(user);
        reg.deactivateAgent('agent-d');

        vm.expectRevert(
            abi.encodeWithSelector(
                AgentRegistry.AgentInactive.selector,
                'agent-d'
            )
        );
        reg.logExecution('agent-d', 'HOLD', 1800e8);
    }

    function test_deactivateAgent_ownerCanDeactivate() public {
        vm.prank(user);
        reg.registerAgent('agent-z', keccak256('cfg'), 'TREND_FOLLOW');

        vm.prank(user);
        reg.deactivateAgent('agent-z');

        (, , , , , bool active) = reg.agents('agent-z');
        assertFalse(active);
    }
}
