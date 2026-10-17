Let me read all the key files to understand the current state of the codebase. Good — I've read all the key files. Here's the honest pre-mainnet assessment:

---

## Current state — what's working and what isn't

### What's working
- Arc gift creation — `createGift` with EIP-712 ephemeral key commits ✓
- Gasless claim via `/api/claim` — hot wallet pays gas, recipient needs zero funds ✓
- Passkey wallet creation flow — WebAuthn registration, deployment via OZ Relayer ✓
- StellarWallet UI — 3-tab balance/send/withdraw component ✓
- Landing page — full-width, consistent navy/sky colours ✓
- Dashboard — bento layout, activity, GiftCreator inline ✓

### What needs verification before mainnet

| # | Issue | Risk |
|---|---|---|
| 1 | WASM hash `b2e858...` — unverified if OZ Relayer actually accepts this on testnet right now | High |
| 2 | `api/passkey-claim.ts` imports from `../server/stellar.js` — does this file exist? | High |
| 3 | `api/claim.ts` — CONTRACT_ADDRESS falls back to `undefined` if neither env var set | Medium |
| 4 | EVM hot wallet `0x3586e3Fb...` — unknown USDC balance, may be dry | Medium |
| 5 | Stellar hot wallet — unknown USDC balance on Stellar Testnet | Medium |
| 6 | `StellarWallet` explorer URL hardcoded to testnet | Must fix for mainnet |
| 7 | `passkeyClient.ts` RPC hardcoded to `soroban-testnet.stellar.org` | Must fix for mainnet |

### The `server/stellar.js` question — critical
`api/passkey-claim.ts` imports `preflightUsdcPayout`, `sendUsdcPayout`, `weiToStroops`, `formatStroops`, `StellarPayoutError` from `../server/stellar.js`. If that file doesn't exist, the passkey claim function crashes on import. Let me check: Good. `server/stellar.ts` exists and is solid. Here is the complete honest picture:

---

## Pre-mainnet checklist — honest assessment

### Things that look good
- `server/stellar.ts` is well-written — handles both `G...` classic and `C...` Soroban contract recipients, correct 18→7 decimal conversion, preflight before irreversible Arc claim
- `api/claim.ts` and `api/passkey-claim.ts` both exist and are logically correct
- `api/relayer.ts` uses `PasskeyServer.send()` — correct pattern
- All env vars are referenced correctly (no hardcoded secrets)
- Gasless claim: hot wallet pays all gas ✓
- Fallback RPC chain in `config.ts` ✓

### Things that need to be done before mainnet

**1. Verify hot wallet balances (you do this)**
- EVM hot wallet `0x3586e3Fb...` — needs USDC on Arc Mainnet for gas
- Stellar hot wallet `G...` — needs USDC on Stellar Mainnet for payouts
- These are the two accounts the server uses for every claim

**2. Four code changes for mainnet (I do these in Build mode)**
- `server/stellar.ts` — `STELLAR_NETWORK` and `STELLAR_HORIZON` and `SOROBAN_RPC` must switch from testnet to mainnet URLs based on an env var
- `passkeyClient.ts` — `RPC_URL` and `NETWORK_PHRASE` and `WALLET_WASM_HASH` must switch to mainnet equivalents
- `StellarWallet.tsx` — `explorerUrl` uses `testnet` hardcoded — must be `mainnet` in production
- `api/passkey-claim.ts` — `ARC_TESTNET` chain ID `5042002` must switch to Arc Mainnet `5042`

**3. Contracts — need a ScratchAndSplit v3 deploy on Arc Mainnet**
The current contract `0xB049c84b...` is on Arc Testnet. Nothing exists on mainnet yet. I need to deploy it fresh.

**4. Vercel env vars to add/update for mainnet**

| Variable | Testnet value | Mainnet value |
|---|---|---|
| `VITE_SCRATCH_CONTRACT_V3` | `0xB049...` testnet | new mainnet address |
| `STELLAR_NETWORK` | `testnet` | `mainnet` |
| `STELLAR_HORIZON_URL` | `horizon-testnet.stellar.org` | `horizon.stellar.org` |
| `STELLAR_RPC_URL` | `soroban-testnet.stellar.org` | `soroban.stellar.org` |
| `STELLAR_USDC_ISSUER` | testnet issuer | `GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN` |
| `VITE_ARC_NETWORK` | `testnet` | `mainnet` |

---

## My recommendation

Do **not** rush to mainnet yet. Two blockers:

**Blocker 1 — The passkey WASM hash for Stellar Mainnet**
Passkey-kit's mainnet WASM hash is different from testnet. We haven't verified what it is for `passkey-kit@0.19.1` on mainnet. Using the wrong hash means every passkey wallet creation fails on mainnet.

**Blocker 2 — Untested end-to-end on testnet**
The Zod error in `createWallet` has not been confirmed fixed yet. The WASM hash `b2e858...` is our best guess but hasn't been verified working in a live test session. Shipping broken passkey creation to mainnet with real money would be bad.

**Recommended path:**
1. Switch to Build mode — I'll add the environment-based network switching so the same codebase works on both testnet and mainnet
2. Confirm the passkey WASM hash works on testnet (you test it)
3. Deploy ScratchAndSplit v3 to Arc Mainnet
4. Fund the mainnet hot wallets
5. Flip `VITE_ARC_NETWORK=mainnet` in Vercel → instant mainnet go-live, no code change

Want me to proceed with step 1 — the environment-based network switching?
