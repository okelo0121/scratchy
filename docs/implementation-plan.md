Let me read all the passkey-related files to get the full picture before we test anything. Good — full picture. Let me read the rest of ClaimCard and the relayer: Good. I have the full picture. Here's the honest assessment of what works and what doesn't:

---

## Passkey flow — issues found

### Issue 1 — WASM hash is likely wrong
`WALLET_WASM_HASH = '502ea4e7...'` was hardcoded earlier. The canonical hash changes with passkey-kit versions and testnet redeployments. Let me verify the actual hash for the installed version:I'm in Plan mode. Let me lay out everything I've found so you can approve the full fix:

---

## Complete list of issues

**Issue 1 — WASM hash unverified**
`WALLET_WASM_HASH` in `passkeyClient.ts` was hardcoded to `502ea4e7...` without verifying against the installed `passkey-kit` version. If the hash is wrong, `createWallet` will silently fail to deploy the smart wallet contract. Need to read the actual hash from `node_modules/passkey-kit` before any real test.

**Issue 2 — Mismatch between `callPasskeyClaim` and `passkey-claim` API**
`passkeyClient.ts` sends `{ ephemeralKeyHex, stellarRecipient, amountUsdc }` but `api/passkey-claim.ts` expects `{ stellarRecipient, amount, giftId }`. The field `amountUsdc` ≠ `amount`. The server will get `amount: undefined` and return a 400 error.

**Issue 3 — Passkey claim skips the Arc contract**
`api/passkey-claim.ts` goes straight to Stellar — it never claims the gift on the Arc contract first. The gift is still locked in the `ScratchAndSplit` contract on Arc. The server needs to: (1) claim on Arc → (2) bridge to Stellar → (3) send to passkey wallet. Right now it only does step 3, sending from the hot wallet's existing balance (which may be zero or insufficient).

**Issue 4 — OpenZeppelin Relayer endpoint**
The relayer proxy posts to `${OZ_RELAYER_BASE}/submit`. The actual OZ Channels API endpoint for submitting a signed XDR may differ — needs verification against the `passkey-kit` docs for the expected relay path.

**Issue 5 — `passkeySupported` check hides button in preview**
The button is correctly hidden in the Arc Studio preview iframe (WebAuthn doesn't work in iframes). Works on `scratchy.okelo.tech` directly in a real browser tab. This is by design — not a bug.

---

## The fix plan

**Fix 1 — Read correct WASM hash from installed passkey-kit**
Pull the canonical `walletWasmHash` from `node_modules/passkey-kit/dist` or its deployment manifest rather than hardcoding.

**Fix 2 — Align body field names**
Change `callPasskeyClaim` to send `amount` instead of `amountUsdc`, matching what the server expects.

**Fix 3 — Wire Arc claim into passkey-claim server function**
The server function needs to use the `ScratchAndSplit` contract ABI to call `claimGift` from the hot EVM wallet before sending on Stellar. This requires `VITE_CONTRACT_ADDRESS` and an EVM hot wallet private key (or using the same `ethers`/`viem` approach as the frontend). The simplest testable version: skip the CCTP bridge for now (since Arc Testnet → Stellar Testnet CCTP is the hard part) and instead fund the Stellar hot wallet manually with testnet USDC for demo purposes, with the Arc claim happening on-chain separately.

**Fix 4 — Test relayer endpoint**
Verify `channels.openzeppelin.com/testnet/submit` is the correct path for the OZ relayer API.

---

## Recommended approach for a working demo

Given the CCTP bridge complexity (15–20s attestation wait, requires a separate EVM hot wallet), the cleanest working demo is:

1. Claim the gift on Arc to the sender's wallet (existing path — already works)
2. Passkey creates a Stellar wallet (WebAuthn registration — works)
3. Server sends testnet USDC from the pre-funded hot wallet to the Stellar passkey wallet (already works — just needs the field name fix)

Steps 1 and 3 are decoupled. The user ends up with USDC in both their Arc wallet AND their new Stellar passkey wallet. For a demo this is fine — it shows the passkey wallet creation and the Stellar USDC receipt. The full CCTP bridge (burning on Arc, attesting, minting on Stellar) is the phase 2 upgrade.

Switch to **Build mode** and I'll fix issues 1–4 and have a working passkey demo flow.
