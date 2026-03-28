// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/utils/ReentrancyGuard.sol';

/// @title MockDEX — Simulated AMM for Angora agent trades on Monad testnet
/// @notice Agents sell MON for mUSDT or buy MON with mUSDT.
///         Uses a fixed 1 MON = 20 mUSDT rate for simplicity.
contract MockDEX is Ownable, ReentrancyGuard {
    error InsufficientLiquidity();
    error ZeroAmount();
    error TransferFailed();

    IERC20 public immutable usdt;

    /// Fixed price: 1 MON = PRICE_USD mUSDT (6 decimals)
    uint256 public constant PRICE_USD = 20 * 10 ** 6;

    event Swap(
        string indexed agentId,
        address indexed trader,
        string direction, // "SELL_MON" | "BUY_MON"
        uint256 monAmount,
        uint256 usdtAmount
    );

    event Funded(address indexed funder, uint256 monAmount);

    constructor(address _usdt) Ownable(msg.sender) {
        usdt = IERC20(_usdt);
    }

    /// @notice Fund the DEX with MON liquidity
    function fundMON() external payable {
        if (msg.value == 0) revert ZeroAmount();
        emit Funded(msg.sender, msg.value);
    }

    /// @notice Agent sells MON → receives mUSDT
    /// @param agentId  The Angora agent identifier
    /// @param minOut   Minimum mUSDT to receive (slippage protection; use 0 in tests)
    function sellMON(
        string memory agentId,
        uint256 minOut
    ) external payable nonReentrant {
        if (msg.value == 0) revert ZeroAmount();

        uint256 usdtOut = (msg.value * PRICE_USD) / 1 ether;
        if (usdtOut < minOut) revert InsufficientLiquidity();
        if (usdt.balanceOf(address(this)) < usdtOut)
            revert InsufficientLiquidity();

        bool ok = usdt.transfer(msg.sender, usdtOut);
        if (!ok) revert TransferFailed();

        emit Swap(agentId, msg.sender, 'SELL_MON', msg.value, usdtOut);
    }

    /// @notice Agent buys MON → spends mUSDT
    /// @param agentId    The Angora agent identifier
    /// @param usdtAmount Amount of mUSDT to spend (6 decimals)
    /// @param minMonOut  Minimum MON to receive (use 0 in tests)
    function buyMON(
        string memory agentId,
        uint256 usdtAmount,
        uint256 minMonOut
    ) external nonReentrant {
        if (usdtAmount == 0) revert ZeroAmount();

        uint256 monOut = (usdtAmount * 1 ether) / PRICE_USD;
        if (monOut < minMonOut) revert InsufficientLiquidity();
        if (address(this).balance < monOut) revert InsufficientLiquidity();

        bool ok = usdt.transferFrom(msg.sender, address(this), usdtAmount);
        if (!ok) revert TransferFailed();

        (bool sent, ) = msg.sender.call{value: monOut}('');
        if (!sent) revert TransferFailed();

        emit Swap(agentId, msg.sender, 'BUY_MON', monOut, usdtAmount);
    }

    /// @notice Owner can drain tokens if needed
    function withdrawUSDT(uint256 amount) external onlyOwner {
        usdt.transfer(msg.sender, amount);
    }

    function withdrawMON(uint256 amount) external onlyOwner {
        (bool ok, ) = msg.sender.call{value: amount}('');
        require(ok, 'withdraw failed');
    }

    receive() external payable {}
}
