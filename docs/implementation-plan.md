Let me read the plan answers that came in earlier — those are the answers to the wallet UX questions. That's the old plan. The current plan answers are in the turn context — let me use those directly. The user answered:

- **Both** — inline panel after claim + persistent `/wallet` page
- **Full** — balance, send to Stellar addresses, withdraw to exchange (Lobstr QR)
- **Both** — nav button for visitors + dashboard tab for signed-in users
- **Mobile-app style** — full screen takeover, feels like a native crypto wallet

Here's the complete plan:

---

## Implementation Plan: Stellar Passkey Wallet

### Summary
A full mobile-app-style Stellar USDC wallet for passkey recipients. Appears inline immediately after claiming, and is accessible permanently via a `/wallet` nav entry (visitors) and a dashboard tab (signed-in users). No account needed — one fingerprint tap to access.

### Architecture
- **Chain:** Stellar Testnet — Soroban smart wallet at `C...` address
- **Auth:** passkey-kit `connectWallet` — one biometric prompt reconnects the wallet
- **Balance:** Stellar Horizon API — `https://horizon-testnet.stellar.org/accounts/{address}` — read USDC trustline balance
- **Send:** passkey-kit signed Stellar payment transaction — submitted via `/api/relayer`
- **Withdraw:** Shows Lobstr QR code + deeplink for the recipient's `C...` address. Lobstr is the most popular Stellar wallet, free, supports USDC, available on iOS + Android.
- **Storage:** `localStorage` caches `sas_stellar_wallet` (address) + `sas_stellar_keyid` (passkey credential ID) so reconnect is instant

### Pages / Entry Points

| Entry | Who sees it | What it does |
|---|---|---|
| Inline on claim success screen | Anyone who just claimed via passkey | Full wallet panel appears immediately — no navigation |
| `/wallet` route in nav | Visitors without an account | "Access my Stellar wallet" — one fingerprint tap |
| "Stellar Wallet" tab in dashboard | Signed-in users | Same wallet panel embedded in the dashboard right column |

### Wallet panel — three tabs

**Tab 1 — Balance**
Full-screen navy panel. Large USDC amount centred. Stellar address with copy button. "Last updated Xs ago" refresh indicator. Animated number count-up on load.

**Tab 2 — Send**
Recipient field (Stellar `G...` address or `C...` contract address). Amount with quick-select pills ($1 / $5 / $10 / Max). Confirm button → biometric prompt → signed tx → submitted via relayer → success animation.

**Tab 3 — Withdraw**
Three options presented as cards:
- **Lobstr** — show QR of their `C...` address + "Open in Lobstr" deeplink button. Lobstr scans the address, user imports wallet. Most accessible.
- **Stellar Expert** — link to `stellar.expert/explorer/testnet/account/{address}` so they can see all transactions
- **Copy address** — plain copy for advanced users to import into any Stellar app

### Files to Create/Modify
1. `src/components/StellarWallet.tsx` — new: full wallet panel, three tabs, all Stellar logic
2. `src/hooks/useStellarBalance.ts` — new: Horizon API balance polling hook
3. `src/hooks/useStellarSend.ts` — new: build + sign + submit Stellar payment via passkey
4. `src/components/ClaimCard.tsx` — show `StellarWallet` inline after successful passkey claim
5. `src/App.tsx` — add `/wallet` hash route, render `StellarWallet` for visitors
6. `src/components/Dashboard.tsx` — add "Stellar Wallet" tab in right column
7. `src/components/Layout.tsx` — add "My Wallet" nav button for visitors

### Build Sequence
1. Write `useStellarBalance.ts` — Horizon balance hook
2. Write `useStellarSend.ts` — passkey-signed payment hook
3. Write `StellarWallet.tsx` — full wallet panel with 3 tabs
4. Wire into `ClaimCard.tsx` — show inline after claim
5. Add `/wallet` route to `App.tsx` + nav entry in `Layout.tsx`
6. Add dashboard tab in `Dashboard.tsx`
7. Lint + typecheck + push

### Done When
- [ ] Passkey claim success immediately shows balance in the wallet panel
- [ ] Send tab: recipient + amount → fingerprint → tx submitted → success
- [ ] Withdraw tab: Lobstr QR + deeplink shown
- [ ] Returning visitor at `/wallet` taps fingerprint → wallet reconnects
- [ ] Dashboard "Stellar Wallet" tab shows same panel for signed-in users
- [ ] Nav "My Wallet" button visible for visitors
- [ ] Zero lint errors

---

Saving this plan and switching to Build mode will execute it. Switch to **Build mode** to start. Plan saved to `arc-studio-plans/PLAN-stellar-wallet.md`.

Switch to **Build mode** and I'll execute all seven steps immediately. The wallet will feel like a native mobile crypto app — dark navy, large balance display, fingerprint auth, three clear tabs. No seed phrase, no exchange account, no steps the recipient has to figure out on their own.
