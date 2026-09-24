# Passkey Claiming — Implementation Notes

## How the passkey button works

The button is wrapped in `{passkeySupported && (...)}` — it only appears when the browser
reports WebAuthn support. This check requires:

1. An **HTTPS page**
2. A **platform authenticator** — Face ID, Touch ID, Windows Hello, or Android fingerprint
3. **Not inside an iframe** — the Arc Studio preview is an iframe which blocks WebAuthn

The button shows correctly on the deployed site at `tutorquest.okelo.tech`.

## Quick test

1. Create a test gift from your dashboard
2. Copy the gift link
3. Open it in a new browser tab on your phone or laptop (not inside Arc Studio)
4. Scratch the card
5. The "Claim with Face ID / Fingerprint" button appears under the two existing options
6. Tap it — your device shows the biometric prompt

## Environment variables required

Server-side only (Netlify environment variables, never in the frontend bundle):

- `STELLAR_HOT_WALLET_SECRET` — Stellar keypair secret (S...)
- `STELLAR_HOT_WALLET_PUBLIC` — Stellar keypair public key (G...)
- `OZ_RELAYER_API_KEY` — OpenZeppelin Relayer API key (from channels.openzeppelin.com)
- `STELLAR_USDC_ISSUER` — GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5

Frontend (VITE_ prefix, safe to be in bundle):

- `VITE_OZ_RELAYER_BASE_URL` — https://channels.openzeppelin.com/testnet
