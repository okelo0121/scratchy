You're absolutely right. This is a fundamental UX problem — a gift recipient should never need funds to claim. Let me understand the full picture of what costs money right now: Now I have the full picture. Here's the honest breakdown:

---

## Why recipients currently need funds

The v3 contract's `claimGift` is `nonpayable` — it costs gas to call. On Arc, gas is paid in USDC. So the recipient needs USDC to pay the gas fee to claim their USDC gift. That's a broken UX loop.

There are two separate claim paths right now:

**Path 1 — Privy "Sign in & Claim"**
The recipient uses their own Privy embedded wallet to call `claimGift` on-chain directly. They need USDC for gas. Broken for new users with zero balance.

**Path 2 — Passkey claim**
The server calls `claimGift` using the EVM hot wallet (`0x3586e3Fb...`) — the server pays the gas. Recipient needs zero funds. This path is already gasless for the recipient.

---

## The real fix — make ALL claim paths gasless

The solution is to move the on-chain `claimGift` call to the server for both paths. The recipient never touches the chain directly — they just provide their address (or passkey wallet), and the server claims on their behalf.

**New flow for both paths:**

```
Recipient opens gift → scratches card
    ↓
Taps "Sign in & Claim" OR "Claim with Fingerprint"
    ↓
Gets their wallet address (Privy embedded wallet OR Stellar passkey address)
    ↓
Sends { ephemeralKeyHex, recipientAddress } to POST /api/claim
    ↓
Server calls claimGift on Arc (pays gas from EVM hot wallet)
    ↓
USDC lands in recipient's wallet — zero gas cost to recipient
```

**What this means:**
- The EVM hot wallet (`0x3586e3Fb...`) pays all claim gas — cost is tiny (Arc fees are ~$0.001)
- Recipients need zero USDC to claim
- The ephemeral key (in the gift URL) authorises the claim — only the person with the URL can trigger it
- Works for both Privy and passkey recipients

---

## Implementation

**One new Vercel function: `api/claim.ts`**
Takes `{ ephemeralKeyHex, recipientAddress }`, signs the EIP-712 claim authorisation, calls `claimGift` from the EVM hot wallet, returns tx hash.

**Update `ClaimCard.tsx`**
Both "Sign in & Claim" and "Send to address" paths hit `/api/claim` instead of calling the contract directly from the browser. The passkey path already does this via `/api/passkey-claim`.

**The EVM hot wallet** (`0x3586e3Fb...`, already in Vercel) covers all gas. Fund it with a small amount of USDC once — it will handle thousands of claims.

---

Ready to build this? It's the most important fix in the whole app. Switch to Build mode and I'll do it now.
