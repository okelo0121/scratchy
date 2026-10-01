# Stellar Passkey Wallet — Implementation Plan

## Summary
A full mobile-app-style Stellar USDC wallet for passkey recipients. Appears inline immediately after claiming, and is accessible permanently via a `/wallet` nav entry (visitors) and a dashboard tab (signed-in users). No account needed — one fingerprint tap to access.

## Architecture
- **Chain:** Stellar Testnet — Soroban smart wallet at `C...` address
- **Auth:** passkey-kit `connectWallet` — one biometric prompt reconnects the wallet
- **Balance:** Stellar Horizon API — `https://horizon-testnet.stellar.org/accounts/{address}` — read USDC trustline balance
- **Send:** passkey-kit signed Stellar payment transaction — submitted via `/api/relayer`
- **Withdraw:** Shows Lobstr QR code + deeplink for the recipient's `C...` address
- **Storage:** `localStorage` caches `sas_stellar_wallet` (address) + `sas_stellar_keyid` (passkey credential ID)

## Pages / Entry Points

| Entry | Who sees it | What it does |
|---|---|---|
| Inline on claim success screen | Anyone who just claimed via passkey | Full wallet panel appears immediately |
| `/wallet` route in nav | Visitors without an account | One fingerprint tap reconnects |
| "Stellar Wallet" tab in dashboard | Signed-in users | Same wallet panel in dashboard right column |

## Wallet Panel — Three Tabs

**Tab 1 — Balance**
Full-screen navy panel. Large USDC amount centred. Stellar address with copy button. Animated number count-up on load.

**Tab 2 — Send**
Recipient `G...` or `C...` address. Amount with quick-select pills. Confirm → biometric → signed tx → relayer → success.

**Tab 3 — Withdraw**
- Lobstr QR of their `C...` address + "Open in Lobstr" deeplink
- Stellar Expert link
- Copy address

## Files to Create/Modify
1. `src/components/StellarWallet.tsx` — new: full wallet panel, three tabs
2. `src/hooks/useStellarBalance.ts` — new: Horizon API balance polling
3. `src/hooks/useStellarSend.ts` — new: passkey-signed payment via relayer
4. `src/components/ClaimCard.tsx` — show StellarWallet inline after passkey claim
5. `src/App.tsx` — add /wallet hash route
6. `src/components/Dashboard.tsx` — add Stellar Wallet tab
7. `src/components/Layout.tsx` — add My Wallet nav button for visitors

## Build Sequence
1. Write useStellarBalance.ts
2. Write useStellarSend.ts
3. Write StellarWallet.tsx
4. Wire into ClaimCard.tsx
5. Add /wallet route to App.tsx + nav entry in Layout.tsx
6. Add dashboard tab in Dashboard.tsx
7. Lint + typecheck + push

## Done When
- [ ] Passkey claim success immediately shows balance in wallet panel
- [ ] Send tab: recipient + amount → fingerprint → tx submitted → success
- [ ] Withdraw tab: Lobstr QR + deeplink shown
- [ ] Returning visitor at /wallet taps fingerprint → wallet reconnects
- [ ] Dashboard Stellar Wallet tab shows same panel for signed-in users
- [ ] Nav My Wallet button visible for visitors
- [ ] Zero lint errors
