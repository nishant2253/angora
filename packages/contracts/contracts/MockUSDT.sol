// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/access/Ownable.sol';

contract MockUSDT is ERC20, Ownable {
    error MaxFaucetExceeded();

    constructor() ERC20('Mock USDT', 'mUSDT') Ownable(msg.sender) {
        _mint(msg.sender, 10_000_000 * 10 ** 6);
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// @notice Free faucet — max 10,000 mUSDT per call
    function faucet(address to, uint256 amount) external {
        if (amount > 10_000 * 10 ** 6) revert MaxFaucetExceeded();
        _mint(to, amount);
    }
}
