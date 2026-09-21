// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract ScratchAndSplit {
    struct Gift {
        address sender;
        uint96 amount;
        uint64 expiresAt;
        bool claimed;
    }

    mapping(bytes32 => Gift) public gifts;

    event GiftCreated(bytes32 indexed commitment, address indexed sender, uint256 amount, uint64 expiresAt);
    event GiftClaimed(bytes32 indexed commitment, address indexed recipient, uint256 amount);
    event GiftRefunded(bytes32 indexed commitment, address indexed sender, uint256 amount);

    /**
     * @notice Creates a gift commitment that can later be revealed and claimed.
     * @dev Commit-reveal scheme:
     *      1) The commitment must be computed off-chain as: keccak256(abi.encodePacked(secretKey))
     *      2) Call createGift with that commitment and fund it with ETH.
     *      3) Later, reveal secretKey via claimGift; funds are released to the specified recipient.
     */
    function createGift(bytes32 commitment, uint64 expiresAt) external payable {
        require(msg.value > 0, "No value sent");
        require(gifts[commitment].sender == address(0), "Commitment exists");
        require(expiresAt > block.timestamp, "Invalid expiry");
        require(msg.value <= type(uint96).max, "Amount too large");

        gifts[commitment] = Gift({
            sender: msg.sender,
            amount: uint96(msg.value),
            expiresAt: expiresAt,
            claimed: false
        });

        emit GiftCreated(commitment, msg.sender, msg.value, expiresAt);
    }

    function claimGift(bytes32 secretKey, address payable recipient) external {
        bytes32 commitment = keccak256(abi.encodePacked(secretKey));
        Gift storage gift = gifts[commitment];

        require(gift.sender != address(0), "Gift not found");
        require(!gift.claimed, "Gift already processed");
        require(block.timestamp <= gift.expiresAt, "Gift expired");

        gift.claimed = true;

        (bool ok, ) = recipient.call{value: gift.amount}("");
        require(ok, "Transfer failed");

        emit GiftClaimed(commitment, recipient, gift.amount);
    }

    function refundGift(bytes32 commitment) external {
        Gift storage gift = gifts[commitment];

        require(gift.sender != address(0), "Gift not found");
        require(!gift.claimed, "Gift already processed");
        require(block.timestamp > gift.expiresAt, "Gift not expired");

        gift.claimed = true;

        (bool ok, ) = payable(gift.sender).call{value: gift.amount}("");
        require(ok, "Transfer failed");

        emit GiftRefunded(commitment, gift.sender, gift.amount);
    }

    function getGift(bytes32 commitment)
        external
        view
        returns (address sender, uint256 amount, uint64 expiresAt, bool claimed)
    {
        Gift memory gift = gifts[commitment];
        return (gift.sender, gift.amount, gift.expiresAt, gift.claimed);
    }
}
