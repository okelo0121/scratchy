// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract TutorQuestSubscription {
    IERC20 public constant USDC = IERC20(0x3600000000000000000000000000000000000000);
    uint256 public constant MONTHLY_FEE = 5_000_000; // 5 USDC (6 decimals)
    uint256 public constant SUBSCRIPTION_DURATION = 30 days;

    address public owner;

    mapping(address => uint256) public subscriptions;

    event Subscribed(address indexed user, uint256 expiryTimestamp);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(address initialOwner) {
        require(initialOwner != address(0), "Invalid owner");
        owner = initialOwner;
    }

    function isPremium(address user) external view returns (bool) {
        return block.timestamp < subscriptions[user];
    }

    function subscribe() external {
        bool success = USDC.transferFrom(msg.sender, address(this), MONTHLY_FEE);
        require(success, "USDC transfer failed");

        uint256 currentExpiry = subscriptions[msg.sender];
        uint256 baseTimestamp = currentExpiry > block.timestamp ? currentExpiry : block.timestamp;
        uint256 newExpiry = baseTimestamp + SUBSCRIPTION_DURATION;

        subscriptions[msg.sender] = newExpiry;
        emit Subscribed(msg.sender, newExpiry);
    }

    function withdrawFees(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Invalid recipient");

        bool success = USDC.transfer(to, amount);
        require(success, "USDC transfer failed");
    }
}
