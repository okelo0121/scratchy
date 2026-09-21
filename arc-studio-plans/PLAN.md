# Scratch & Split — Landing + Dashboard Update

## Summary
Two focused changes to the existing Scratch & Split USDC gift card app:
1. Landing page shows animated rotating occasion messages to **visitors** (not signed in). "Create a Scratch Gift" + occasion cards only appear **after sign-in**.
2. New **Dashboard** screen (signed-in only) with USDC balance, Send USDC, Withdraw USDC, gifts sent history, gifts received history.

---

## Change 1 — LandingHero.tsx (rewrite)

### Visitor state (not authenticated)
- Remove occasion cards and "Create a Scratch Gift" CTA entirely from the visitor view
- Replace with an **animated occasion message carousel** — a single tall card that cycles through 6 messages every 2.8 seconds using `AnimatePresence` `mode="wait"` with slide-up/fade-out transitions
- Each message: large emoji (wobble keyframe on entry via `animate` prop), bold title in `font-display`, coloured subtitle in `font-body`, glowing border + box-shadow matching the message colour
- Messages:
  1. 🎂 "Send a Birthday surprise" / "$5 USDC wrapped in scratch-off foil" / coral `#F87171`
  2. ☕ "Buy someone a coffee" / "$1 USDC delivered as a magic scratch card" / orange `#F97316`
  3. 🎉 "Celebrate a big win" / "$10 USDC — scratch to reveal the cheer" / lavender `#A78BFA`
  4. 🎁 "Send any amount, your way" / "You set the amount, they get the surprise" / mint `#34D399`
  5. 💌 "A note + photo + real money" / "Hide a message under the foil" / pink `#F472B6`
  6. ⚡ "Claimed in under a second" / "Arc Testnet — sub-second finality" / sky `#38BDF8`
- Dot indicators below the card — clicking a dot jumps to that message; active dot stretches wider (pill shape)
- Pulsing "✨ Sign in to create your first scratch gift" nudge below the carousel (opacity pulse animation, loops)
- CTAs for visitors: "✨ Sign In to Send a Gift" (purple gradient) + "🔍 Claim" (white)

### Authenticated state
- Occasion cards grid (2×2, same cartoony style as before) stagger in on mount
- CTAs: "🎁 Create a Scratch Gift" (purple gradient) + "📊 Dashboard" (mint/green gradient)
- No carousel shown

### Prop change
Add `onDashboard: () => void` prop alongside existing `onCreateGift` and `onClaimGift`.

---

## Change 2 — Dashboard.tsx (new: src/components/Dashboard.tsx)

Full-screen dashboard shown to signed-in users. Same cartoony card style (thick borders, bottom shadow, rounded-3xl).

### Layout — 4 sections stacked vertically

#### A — USDC Balance card
- Coral/pink gradient header strip: "💰 My Wallet"
- Large USDC balance display — reads native balance via `useBalance` wagmi hook on the Privy embedded wallet address
- Wallet address truncated (first 6 + last 4 chars), copy-to-clipboard button
- Two action buttons side-by-side: "📤 Send USDC" and "🏦 Withdraw"

#### B — Send USDC panel (inline, `AnimatePresence` slide-down when Send clicked)
- Recipient address input (text field, full width, `rounded-2xl`)
- Amount input (number, USDC) with quick-select pills: $1 / $5 / $10
- "Send 📤" button — calls `eth_sendTransaction` via `privyWallet.getEthereumProvider()` with `value = toHex(parseEther(amount))` to the given address
- `TxStatusBadge` while confirming; clears and closes panel on success

#### C — Withdraw panel (inline, `AnimatePresence` slide-down when Withdraw clicked)
- Destination address input + label field
- "Save address" toggle — saves `{ label, address }` to `localStorage` key `sas_address_book` (JSON array)
- Saved addresses rendered as chips below the input; clicking a chip fills the address field
- Amount input with "Max" button — fills full balance minus `0.001` USDC buffer for fees
- "Withdraw 🏦" button — same `eth_sendTransaction` via Privy provider
- `TxStatusBadge` while confirming

#### D — Gift history (two tabs: Sent / Received)
- Pill tab bar: "🎁 Gifts Sent" / "📬 Gifts Received"
- **Sent:** reads `sas_sent_gifts` from `localStorage` (array written by `GiftCreator` on tx success). Each row: occasion emoji + label, amount USDC, date, status pill (Pending / Claimed / Expired) — status read from `gifts[commitment]` via `useReadContract`
- **Received:** reads `sas_received_gifts` from `localStorage` (array written by `ClaimCard` on claim success). Each row: sender address truncated, amount, date claimed
- Empty state for each tab: small mascot + "No gifts yet — create your first one!" with a "🎁 Create Gift" button

### Props
```ts
interface DashboardProps {
  onBack: () => void
  onCreateGift: () => void
}
```

---

## Change 3 — App.tsx (targeted edits only)

- Add `'dashboard'` to Route type: `type Route = 'landing' | 'create' | 'gift' | 'dashboard'`
- Pass `onDashboard={() => setRoute('dashboard')}` to `<LandingHero />`
- Add `route === 'dashboard'` branch in `AnimatePresence`: renders `<Dashboard onBack={() => setRoute('landing')} onCreateGift={handleCreateGift} />`
- No other changes

---

## Files

| File | Action |
|---|---|
| `src/components/LandingHero.tsx` | Rewrite |
| `src/components/Dashboard.tsx` | Create new |
| `src/App.tsx` | Targeted edits (add route + prop) |

---

## Build sequence

1. Rewrite `src/components/LandingHero.tsx` — visitor carousel, auth-gated occasion cards, new `onDashboard` prop
2. Write `src/components/Dashboard.tsx` — balance, send, withdraw, gift history tabs
3. Edit `src/App.tsx` — add `dashboard` to Route type, render Dashboard, pass `onDashboard` to LandingHero
4. `bun run check` — lint + typecheck; fix any errors

---

## Done when
- [ ] Visitor sees animated cycling occasion message card (no create button, no occasion grid)
- [ ] Dot indicators navigate between messages
- [ ] "✨ Sign in to send a gift" pulsing nudge visible for visitors
- [ ] After sign-in: occasion cards grid + "Create a Scratch Gift" + "Dashboard" CTAs appear
- [ ] Dashboard shows live USDC balance from Privy embedded wallet
- [ ] Send panel: enter address + amount → sends native USDC → TxStatusBadge confirms
- [ ] Withdraw panel: type or pick saved address → sends USDC → confirms; address book persists in localStorage
- [ ] Gifts Sent tab shows history with onchain status (Pending/Claimed/Expired)
- [ ] Gifts Received tab shows claimed gifts
- [ ] `bun run check` passes zero errors
