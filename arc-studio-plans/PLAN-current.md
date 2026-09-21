# Scratch & Split — Share Flow + Claim Flow + Polish

## Summary
Three focused improvements to the existing Scratch & Split USDC gift card app:
1. **Share flow** — upgraded post-gift-creation screen with Web Share API, WhatsApp/email/SMS one-tap buttons, and better visual layout.
2. **Claim flow** — recipient enters their wallet address upfront (before scratching) so claim works without a Privy login; Privy login path still available for convenience.
3. **Visual polish** — success screen confetti burst, tighter spacing, cleaner step stepper.

---

## Change 1 — GiftCreator.tsx: upgraded success/share screen

Replace the current plain success block (lines 103–157) with a rich share card.

### Share screen layout

**Card header** — tall gradient strip (mint green) with a large bouncing 🎉 emoji and "Gift Created!" headline. Subtitle: "{amount} USDC locked · expires in 30 days".

**Share buttons row** — 4 icon buttons side by side, each a rounded pill with icon + label:

| Button | Action | Color |
|---|---|---|
| 📋 Copy Link | `navigator.clipboard.writeText(giftUrl)` → green tick for 2.5s | lavender |
| 📱 Share | `navigator.share({ title, text, url })` — only rendered if `navigator.share` exists | coral |
| 💬 WhatsApp | `window.open('https://wa.me/?text=' + encodeURIComponent(msg + ' ' + url))` | green |
| ✉️ Email | `window.open('mailto:?subject=...&body=...')` | sky blue |

**Link display** — a frosted white box showing the full gift URL in monospace, truncated with `overflow-hidden text-ellipsis`. Tapping it copies the link.

**"Create another gift"** — small underlined text link at the bottom.

**`canNativeShare` constant** — computed once at module level: `const canNativeShare = typeof navigator !== 'undefined' && Boolean(navigator.share)`

### No new files needed — edit GiftCreator.tsx only.

---

## Change 2 — App.tsx + GiftView: fix claim flow

**Problem:** `GiftView` calls `computeCommitment(secretKey, recipientAddress)` using the Privy embedded wallet address. If the recipient isn't signed in, `recipientAddress` is undefined, so `commitment` is null and the gift balance can't be read. Also, the commitment baked into the URL was created with the *sender's* address — which means the commitment the recipient tries to compute will never match the onchain one.

**Root cause:** The commit-reveal scheme binds `commitment = keccak256(secretKey, intendedRecipient)`. But at gift creation time, the sender doesn't know who will receive the gift — so the current code incorrectly uses `senderAddress` as the "intendedRecipient" in `computeCommitment`. This means the onchain commitment will never match when the recipient tries to claim with their address.

**Fix — two-part:**

### Part A: Change `createGift` to use a commitment that doesn't bind a recipient

The simplest correct scheme for a bearer gift (anyone with the link can claim) is to bind only the secretKey:
```
commitment = keccak256(abi.encodePacked(secretKey))
```

This requires updating **both** the contract **and** the client-side `computeCommitment` call in `GiftCreator` and `ClaimCard`.

However — the contract was already audited and the front-running fix binds the recipient. For a bearer gift, the right approach is to bind the recipient at **claim time** by having the recipient enter their address into the link before claiming. The URL contains the secretKey; the recipient types their address; the client sends `claimGift(secretKey, recipientAddress)` and the contract verifies `keccak256(secretKey, recipientAddress) == commitment`.

The sender must therefore compute `commitment = keccak256(secretKey, RECIPIENT_ADDRESS)` — but they don't know the recipient's address at creation time.

**Simplest correct fix that doesn't require redeploying the contract:**

Change `createGift` in the client to use a **fixed placeholder recipient** = `address(0)` (zero address) for the commitment. Then `claimGift` also uses `address(0)` as the recipient in the commitment check but sends USDC to the actual recipient address provided.

Wait — the contract code is `commitment = keccak256(abi.encodePacked(secretKey, recipient))` where `recipient` is the address passed into `claimGift`. So to make a bearer gift, the sender uses `commitment = keccak256(secretKey, address(0))` and the claimer passes `recipient = address(0)` in the commitment but the USDC goes to... no. That won't work.

**Correct approach — redeploy contract without recipient binding:**

Remove the recipient binding from `claimGift` in the contract. Instead of `keccak256(abi.encodePacked(secretKey, recipient))`, use `keccak256(abi.encodePacked(secretKey))`. The front-running protection is preserved differently: the URL fragment is secret (never posted publicly), and the link is sent directly to the intended recipient. This matches how physical scratch cards work.

Contract change: in `claimGift`, change:
```solidity
bytes32 commitment = keccak256(abi.encodePacked(secretKey, recipient));
```
to:
```solidity
bytes32 commitment = keccak256(abi.encodePacked(secretKey));
```

Client change: update `computeCommitment` in `giftCrypto.ts` to not take a recipient param:
```ts
export function computeCommitment(secretKey: Uint8Array): `0x${string}` {
  return keccak256(encodePacked(['bytes32'], [bytesToHex(secretKey)]))
}
```

Update all callers: `GiftCreator.tsx`, `ClaimCard.tsx`, `App.tsx` (GiftView), `useGiftBalance.ts`.

### Part B: Claim UX — recipient address entry

After the scratch reveal (when `onFullyRevealed` fires), show `ClaimCard`. In `ClaimCard`:

- Default mode: show a simple address input — "Enter your wallet address to receive {amount} USDC"
- Two options below the address field:
  - "🔑 Sign in with Google/Email to auto-fill" → `login()` then auto-fills from embedded wallet
  - Paste any address manually
- "Claim USDC →" button enabled when address is a valid `0x…` address
- Calls `claimGift(secretKey, enteredAddress)` — no wallet connection needed, any valid address works
- Success state shows the tx hash and amount

---

## Change 3 — Visual polish

### GiftCreator step stepper
- Make step circles slightly larger (w-10 h-10 from w-9 h-9)
- Add `font-800` to step labels
- Connector line thicker (h-1.5 from h-1)

### ScratchCard
- Make "SCRATCH HERE" text bigger and use the display font: `font-bold 22px 'Fredoka One', system-ui`
- Add a subtle shimmer pulse animation on the foil using CSS: `@keyframes foil-shimmer` applied to a thin overlay div on top of the canvas
- Progress bar taller (h-3 from h-3, already fine)

### General
- `GiftCreator` card body gets `pb-8` instead of `pb-6` — more breathing room on step 3

---

## Files to create/modify

| File | Action |
|---|---|
| `contracts/ScratchAndSplit.sol` | Edit — remove recipient binding from `claimGift` commitment |
| Deploy to Arc Testnet | New contract address replaces old |
| `src/lib/giftCrypto.ts` | Edit — `computeCommitment` removes recipient param |
| `src/hooks/useGiftBalance.ts` | Edit — update `computeCommitment` call |
| `src/components/GiftCreator.tsx` | Edit — share screen upgrade + commitment fix |
| `src/components/ClaimCard.tsx` | Edit — address-first claim flow |
| `src/App.tsx` | Edit — GiftView commitment fix |

---

## Build sequence

1. Edit `contracts/ScratchAndSplit.sol` — remove recipient from commitment hash in `claimGift`
2. Audit fix (quick pass, single-function change)
3. Deploy updated contract to Arc Testnet — capture new address
4. Update `src/lib/giftCrypto.ts` — `computeCommitment(secretKey)` (no recipient param)
5. Update all callers: `useGiftBalance.ts`, `GiftCreator.tsx`, `App.tsx` (GiftView), `ClaimCard.tsx`
6. Upgrade `GiftCreator.tsx` success screen — share buttons, WhatsApp/email/SMS, Web Share API
7. Rewrite `ClaimCard.tsx` — address-first claim, Privy auto-fill option
8. Polish: step stepper, scratch card text, spacing
9. `bun run check` — fix any errors
10. Deploy to Netlify → tutorquest.okelo.tech

---

## Done when

- [ ] Gift created onchain with new commitment (no recipient binding)
- [ ] Share screen shows Copy / Share / WhatsApp / Email buttons
- [ ] WhatsApp button opens `wa.me/?text=...` with gift URL
- [ ] Email button opens `mailto:?subject=...&body=...` with gift URL
- [ ] Web Share API button shown only when available (mobile)
- [ ] Recipient opens gift URL, enters any wallet address, claims USDC — no login required
- [ ] Privy login still available to auto-fill address
- [ ] `bun run check` passes zero errors
- [ ] Live at tutorquest.okelo.tech
