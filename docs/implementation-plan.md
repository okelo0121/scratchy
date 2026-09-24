Got it. Do not share that key publicly or commit it to GitHub — it's a server-side secret and should only live in your Netlify environment variables and your local `.env` file (which is already in `.gitignore`).

Now let me check the current `.env` and then write the hot wallet setup script. Good — `.env` is already gitignored. Now writing the hot wallet setup script and adding the env vars: I'm in Plan mode — I need you to switch to **Build mode** using the mode selector. Once you do, I'll immediately:

1. Write the hot wallet setup script
2. Run it to generate your Stellar keypair
3. Add all env vars
4. Install deps and build the full passkey claim feature

---

**While you switch modes, here is everything that happens in sequence:**

**Step 1 — Run `scripts/setup-stellar-wallet.ts`**
Generates a fresh Stellar keypair, funds it via Friendbot (free testnet XLM), and establishes a USDC trustline. Prints the `G...` public key and `S...` secret key. You add those to `.env` and Netlify dashboard.

**Step 2 — Add to `.env`**
```
STELLAR_HOT_WALLET_PUBLIC=G...
STELLAR_HOT_WALLET_SECRET=S...
OZ_RELAYER_API_KEY=80729b6d-cc3b-46b2-b0b2-5d016c867348
STELLAR_USDC_ISSUER=GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5
```
The relayer key and hot wallet secret go into Netlify dashboard too (`Site settings → Environment variables`) — never in the frontend bundle.

**Step 3 — Install deps**
```
bun add passkey-kit @stellar/stellar-sdk @openzeppelin/relayer-plugin-channels
```

**Step 4 — Write `netlify/functions/passkey-claim.ts`**
Serverless function: verify gift on Arc → claim to hot wallet → CCTP bridge Arc→Stellar → send USDC to recipient's Stellar smart wallet.

**Step 5 — Write `netlify/functions/relayer-proxy.ts`**
Thin proxy keeping the relayer API key server-side.

**Step 6 — Write `src/lib/passkeyClient.ts`**
Browser-side PasskeyKit instance with LocalStorageAdapter.

**Step 7 — Update `ClaimCard.tsx`**
Add "👆 Claim with Face ID / Fingerprint" button as a third claim path.

**Step 8 — Lint + typecheck + deploy**

Switch to **Build mode** now.
