// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/utils/ReentrancyGuard.sol';

contract AgentRegistry is Ownable, ReentrancyGuard {
    error AlreadyRegistered(string agentId);
    error AgentInactive(string agentId);

    struct Agent {
        string agentId;
        address owner;
        bytes32 configHash;
        string strategyType;
        uint256 deployedAt;
        bool active;
    }

    mapping(string => Agent) public agents;
    mapping(address => string[]) public ownerAgents;

    event AgentRegistered(
        string indexed agentId,
        address owner,
        string strategyType
    );
    event AgentExecuted(
        string indexed agentId,
        string signal,
        uint256 price,
        uint256 ts
    );

    constructor() Ownable(msg.sender) {}

    function registerAgent(
        string memory agentId,
        bytes32 configHash,
        string memory strategyType
    ) external nonReentrant {
        if (agents[agentId].deployedAt != 0) revert AlreadyRegistered(agentId);
        agents[agentId] = Agent(
            agentId,
            msg.sender,
            configHash,
            strategyType,
            block.timestamp,
            true
        );
        ownerAgents[msg.sender].push(agentId);
        emit AgentRegistered(agentId, msg.sender, strategyType);
    }

    function logExecution(
        string memory agentId,
        string memory signal,
        uint256 price
    ) external {
        if (!agents[agentId].active) revert AgentInactive(agentId);
        emit AgentExecuted(agentId, signal, price, block.timestamp);
    }

    /// @notice Deactivate an agent (owner only)
    function deactivateAgent(string memory agentId) external {
        require(
            agents[agentId].owner == msg.sender || owner() == msg.sender,
            'Not authorized'
        );
        agents[agentId].active = false;
    }

    /// @notice Returns all agent IDs owned by an address
    function getOwnerAgents(
        address ownerAddr
    ) external view returns (string[] memory) {
        return ownerAgents[ownerAddr];
    }
}
