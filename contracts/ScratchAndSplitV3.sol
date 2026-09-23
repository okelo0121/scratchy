// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ScratchAndSplitV3
 * @notice Gamified USDC gift cards with EIP-712 signature-bound claiming.
 * @dev Replaces vulnerable symmetric plaintext secrets with asymmetric ephemeral keypairs.
 *      - Ephemeral signer address is registered at creation.
 *      - Claims are signed by the ephemeral private key and cryptographically bound to the recipient address.
 *      - Prevents all mempool front-running / MEV theft.
 *      - Enables permissionless gasless relaying: anyone or any relayer can submit the claim on behalf of the recipient.
 *      - Enables senders to cancel an unclaimed gift before expiry.
 */
contract ScratchAndSplitV3 is EIP712, ReentrancyGuard {
    struct Gift {
        address sender;
        uint96 amount;
        uint64 expiresAt;
        bool claimed;
    }

    bytes32 public constant CLAIM_TYPEHASH =
        keccak256("ClaimGift(address recipient,address ephemeralSigner,uint64 deadline)");

    mapping(address => Gift) public gifts;

    event GiftCreated(address indexed ephemeralSigner, address indexed sender, uint256 amount, uint64 expiresAt);
    event GiftClaimed(address indexed ephemeralSigner, address indexed recipient, uint256 amount);
    event GiftCancelled(address indexed ephemeralSigner, address indexed sender, uint256 amount);
    event GiftRefunded(address indexed ephemeralSigner, address indexed sender, uint256 amount);

    error ZeroValue();
    error InvalidSigner();
    error GiftAlreadyExists();
    error InvalidExpiry();
    error AmountTooLarge();
    error GiftNotFound();
    error GiftAlreadyProcessed();
    error GiftExpired();
    error GiftNotExpired();
    error ClaimDeadlinePassed();
    error Unauthorized();
    error InvalidSignature();
    error TransferFailed();

    constructor() EIP712("ScratchAndSplit", "3") {}

    /**
     * @notice Creates a new gift bound to an ephemeral public key address.
     * @param ephemeralSigner The public address of the one-time ephemeral keypair.
     * @param expiresAt Unix timestamp when the gift expires.
     */
    function createGift(address ephemeralSigner, uint64 expiresAt) external payable nonReentrant {
        if (msg.value == 0) revert ZeroValue();
        if (ephemeralSigner == address(0)) revert InvalidSigner();
        if (gifts[ephemeralSigner].sender != address(0)) revert GiftAlreadyExists();
        if (expiresAt <= block.timestamp) revert InvalidExpiry();
        if (msg.value > type(uint96).max) revert AmountTooLarge();

        gifts[ephemeralSigner] = Gift({
            sender: msg.sender,
            amount: uint96(msg.value),
            expiresAt: expiresAt,
            claimed: false
        });

        emit GiftCreated(ephemeralSigner, msg.sender, msg.value, expiresAt);
    }

    /**
     * @notice Claims a gift to a recipient address verified by the ephemeral signer's signature.
     * @dev Permissionless caller: can be called by recipient directly, or by a gasless relayer.
     *      Front-running is impossible because the signature is uniquely bound to `recipient`.
     * @param recipient The address receiving the gift funds.
     * @param ephemeralSigner The ephemeral public address owning this gift.
     * @param deadline Unix timestamp until which this claim signature is valid.
     * @param signature The EIP-712 signature produced by the ephemeral private key.
     */
    function claimGift(
        address payable recipient,
        address ephemeralSigner,
        uint64 deadline,
        bytes calldata signature
    ) external nonReentrant {
        if (recipient == address(0)) revert Unauthorized();
        if (block.timestamp > deadline) revert ClaimDeadlinePassed();

        Gift storage gift = gifts[ephemeralSigner];
        if (gift.sender == address(0)) revert GiftNotFound();
        if (gift.claimed) revert GiftAlreadyProcessed();
        if (block.timestamp > gift.expiresAt) revert GiftExpired();

        bytes32 structHash = keccak256(abi.encode(CLAIM_TYPEHASH, recipient, ephemeralSigner, deadline));
        bytes32 digest = _hashTypedDataV4(structHash);
        address recovered = ECDSA.recover(digest, signature);
        if (recovered != ephemeralSigner) revert InvalidSignature();

        gift.claimed = true;

        (bool ok, ) = recipient.call{value: gift.amount}("");
        if (!ok) revert TransferFailed();

        emit GiftClaimed(ephemeralSigner, recipient, gift.amount);
    }

    /**
     * @notice Allows the original sender to cancel an unclaimed gift before expiry.
     * @param ephemeralSigner The ephemeral public address owning this gift.
     */
    function cancelGift(address ephemeralSigner) external nonReentrant {
        Gift storage gift = gifts[ephemeralSigner];
        if (gift.sender == address(0)) revert GiftNotFound();
        if (msg.sender != gift.sender) revert Unauthorized();
        if (gift.claimed) revert GiftAlreadyProcessed();

        gift.claimed = true;

        (bool ok, ) = payable(gift.sender).call{value: gift.amount}("");
        if (!ok) revert TransferFailed();

        emit GiftCancelled(ephemeralSigner, gift.sender, gift.amount);
    }

    /**
     * @notice Allows anyone to refund an expired, unclaimed gift back to the original sender.
     * @param ephemeralSigner The ephemeral public address owning this gift.
     */
    function refundGift(address ephemeralSigner) external nonReentrant {
        Gift storage gift = gifts[ephemeralSigner];
        if (gift.sender == address(0)) revert GiftNotFound();
        if (gift.claimed) revert GiftAlreadyProcessed();
        if (block.timestamp <= gift.expiresAt) revert GiftNotExpired();

        gift.claimed = true;

        (bool ok, ) = payable(gift.sender).call{value: gift.amount}("");
        if (!ok) revert TransferFailed();

        emit GiftRefunded(ephemeralSigner, gift.sender, gift.amount);
    }

    /**
     * @notice Query gift details by ephemeral signer address.
     */
    function getGift(address ephemeralSigner)
        external
        view
        returns (address sender, uint256 amount, uint64 expiresAt, bool claimed)
    {
        Gift memory gift = gifts[ephemeralSigner];
        return (gift.sender, gift.amount, gift.expiresAt, gift.claimed);
    }
}
