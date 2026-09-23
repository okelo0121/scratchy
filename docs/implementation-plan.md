This error comes from inside Privy's modal — `ModalFooter` and the Privy UI components are in the stack trace, not our code. Let me read `useSendTx` to understand exactly what's happening: I can see the root cause now. The stack trace shows `ModalFooter` from Privy's own UI — this means the error is thrown **inside Privy's transaction confirmation modal**, not in our `eth_sendTransaction` call. What's happening:

**The real bug:** When `claimGift` is called, Privy shows its own native transaction approval modal (the popup asking "Confirm transaction"). When the user clicks "Confirm" in that modal, Privy tries to submit the tx but it fails because **the chain is not switched** — the Privy embedded wallet may be on a different chain than Arc Testnet (5042002), and the `chainId` field in our params object is being ignored by the Privy provider (it doesn't force a chain switch, it just rejects).

The fix is to **explicitly switch the wallet to Arc Testnet before calling `eth_sendTransaction`**: This session is in Plan mode. Switch to **Build mode** using the mode selector — here's the exact change that will execute immediately:

---

**One targeted edit to `useSendTx` in `useGiftContract.ts`:**

Before calling `eth_sendTransaction`, insert a `wallet_switchEthereumChain` call to force the Privy wallet onto Arc Testnet (chain `0x4CE992` = 5042002). If the chain isn't added yet (error code 4902), call `wallet_addEthereumChain` first with Arc Testnet's RPC and explorer URLs, then switch.

This is the standard EIP-3326 / EIP-3085 chain switch pattern. Privy's embedded wallet supports both methods. Without this, Privy submits the transaction on whatever chain the wallet last used — which is why the tx fails inside Privy's own modal footer rather than in our code.

Then lint + typecheck + deploy.
