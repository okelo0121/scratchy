// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ScratchAndSplitV3} from "../ScratchAndSplitV3.sol";

contract ScratchAndSplitV3Test is Test {
    ScratchAndSplitV3 public contractV3;

    uint256 internal senderPrivateKey = 0xA11CE;
    address internal sender = vm.addr(senderPrivateKey);

    uint256 internal recipientPrivateKey = 0xB0B;
    address payable internal recipient = payable(vm.addr(recipientPrivateKey));

    uint256 internal attackerPrivateKey = 0xBAD;
    address payable internal attacker = payable(vm.addr(attackerPrivateKey));

    uint256 internal ephemeralPrivateKey = 0xCAFE;
    address internal ephemeralSigner = vm.addr(ephemeralPrivateKey);

    bytes32 internal constant CLAIM_TYPEHASH =
        keccak256("ClaimGift(address recipient,address ephemeralSigner,uint64 deadline)");

    function setUp() public {
        contractV3 = new ScratchAndSplitV3();
        vm.deal(sender, 100 ether);
        vm.deal(attacker, 10 ether);
    }

    function _signClaim(
        uint256 privKey,
        address targetRecipient,
        address signerAddr,
        uint64 deadline
    ) internal view returns (bytes memory) {
        bytes32 structHash = keccak256(abi.encode(CLAIM_TYPEHASH, targetRecipient, signerAddr, deadline));
        bytes32 domainSeparator = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("ScratchAndSplit")),
                keccak256(bytes("3")),
                block.chainid,
                address(contractV3)
            )
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privKey, digest);
        return abi.encodePacked(r, s, v);
    }

    function test_CreateAndClaimGift() public {
        uint64 expiresAt = uint64(block.timestamp + 30 days);
        uint96 amount = 5 ether;

        vm.prank(sender);
        contractV3.createGift{value: amount}(ephemeralSigner, expiresAt);

        (address giftSender, uint256 giftAmount, uint64 giftExpiry, bool claimed) =
            contractV3.getGift(ephemeralSigner);
        assertEq(giftSender, sender);
        assertEq(giftAmount, amount);
        assertEq(giftExpiry, expiresAt);
        assertFalse(claimed);

        // Recipient signs claim payload
        uint64 deadline = uint64(block.timestamp + 1 hours);
        bytes memory signature = _signClaim(ephemeralPrivateKey, recipient, ephemeralSigner, deadline);

        uint256 recipientBalBefore = recipient.balance;

        // Any relayer can submit (simulated here by attacker or arbitrary address)
        vm.prank(address(0x123456));
        contractV3.claimGift(recipient, ephemeralSigner, deadline, signature);

        assertEq(recipient.balance, recipientBalBefore + amount);

        (,,, claimed) = contractV3.getGift(ephemeralSigner);
        assertTrue(claimed);
    }

    function test_FrontRunFailsWhenAttackerSubstitutesRecipient() public {
        uint64 expiresAt = uint64(block.timestamp + 30 days);
        uint96 amount = 5 ether;

        vm.prank(sender);
        contractV3.createGift{value: amount}(ephemeralSigner, expiresAt);

        uint64 deadline = uint64(block.timestamp + 1 hours);
        // Signature created for legitimate recipient
        bytes memory signature = _signClaim(ephemeralPrivateKey, recipient, ephemeralSigner, deadline);

        // Attacker sees transaction in mempool and tries to claim to themselves using the same signature
        vm.prank(attacker);
        vm.expectRevert(ScratchAndSplitV3.InvalidSignature.selector);
        contractV3.claimGift(attacker, ephemeralSigner, deadline, signature);
    }

    function test_SenderCanCancelGiftBeforeClaim() public {
        uint64 expiresAt = uint64(block.timestamp + 30 days);
        uint96 amount = 5 ether;

        vm.prank(sender);
        contractV3.createGift{value: amount}(ephemeralSigner, expiresAt);

        uint256 senderBalBefore = sender.balance;

        vm.prank(sender);
        contractV3.cancelGift(ephemeralSigner);

        assertEq(sender.balance, senderBalBefore + amount);

        (,,, bool claimed) = contractV3.getGift(ephemeralSigner);
        assertTrue(claimed);

        // Claiming after cancellation reverts
        uint64 deadline = uint64(block.timestamp + 1 hours);
        bytes memory signature = _signClaim(ephemeralPrivateKey, recipient, ephemeralSigner, deadline);

        vm.prank(recipient);
        vm.expectRevert(ScratchAndSplitV3.GiftAlreadyProcessed.selector);
        contractV3.claimGift(recipient, ephemeralSigner, deadline, signature);
    }

    function test_NonSenderCannotCancelGift() public {
        uint64 expiresAt = uint64(block.timestamp + 30 days);
        uint96 amount = 5 ether;

        vm.prank(sender);
        contractV3.createGift{value: amount}(ephemeralSigner, expiresAt);

        vm.prank(attacker);
        vm.expectRevert(ScratchAndSplitV3.Unauthorized.selector);
        contractV3.cancelGift(ephemeralSigner);
    }

    function test_RefundAfterExpiry() public {
        uint64 expiresAt = uint64(block.timestamp + 5 days);
        uint96 amount = 5 ether;

        vm.prank(sender);
        contractV3.createGift{value: amount}(ephemeralSigner, expiresAt);

        // Attempt refund before expiry fails
        vm.expectRevert(ScratchAndSplitV3.GiftNotExpired.selector);
        contractV3.refundGift(ephemeralSigner);

        // Warp past expiry
        vm.warp(block.timestamp + 6 days);

        uint256 senderBalBefore = sender.balance;

        // Permissionless refund call
        vm.prank(address(0x999));
        contractV3.refundGift(ephemeralSigner);

        assertEq(sender.balance, senderBalBefore + amount);
    }
}
