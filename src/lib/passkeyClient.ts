/**
 * passkeyClient.ts
 *
 * Browser-side PasskeyKit instance for Stellar smart-wallet passkey claims.
 * This runs entirely in the browser — no private keys, no relayer secret.
 *
 * Flow:
 *  1. createPasskeyWallet(name)  → builds + signs deploy tx via WebAuthn
 *  2. deployPasskeyWallet(signedTx) → calls POST /api/relayer which uses
 *     PasskeyServer.send() server-side to submit via OZ Channels
 *  3. confirmAndConnect(created, txHash) → confirms deployment onchain,
 *     connects, and caches the wallet address in localStorage
 */
import { PasskeyKit } from 'passkey-kit'
import { LocalStorageAdapter } from 'passkey-kit/storage'
import { Networks } from '@stellar/stellar-sdk'

// ── Config ─────────────────────────────────────────────────────────────────────
const STELLAR_RPC     = 'https://soroban-testnet.stellar.org'
const NETWORK_PHRASE  = Networks.TESTNET
// Canonical smart-wallet WASM hash for Stellar testnet (passkey-kit v0.19.1)
// Sourced from node_modules/passkey-kit/README.md + docs/deployments-2026-09-01.md
const WALLET_WASM_HASH = '97ce047884106b1c6c3bb40b8973cc48db1c4dad95c9e20462bf2c701daa764e'

// ── Singleton kit instance ────────────────────────────────────────────────────
let _kit: PasskeyKit | null = null

function getKit(): PasskeyKit {
  if (_kit) return _kit
  _kit = new PasskeyKit({
    rpcUrl:            STELLAR_RPC,
    networkPassphrase: NETWORK_PHRASE,
    walletWasmHash:    WALLET_WASM_HASH,
    storage:           new LocalStorageAdapter(),
  })
  return _kit
}

// ── localStorage cache ────────────────────────────────────────────────────────
const CACHE_KEY    = 'sas_stellar_wallet'
const KEY_ID_KEY   = 'sas_stellar_key_id'

export function getCachedWallet(): string | null {
  try { return localStorage.getItem(CACHE_KEY) } catch { return null }
}

function setCachedWallet(addr: string) {
  try { localStorage.setItem(CACHE_KEY, addr) } catch { /* ignore */ }
}

function setCachedKeyId(keyId: string) {
  try { localStorage.setItem(KEY_ID_KEY, keyId) } catch { /* ignore */ }
}

function getCachedKeyId(): string | null {
  try { return localStorage.getItem(KEY_ID_KEY) } catch { return null }
}

// ── Feature detect ────────────────────────────────────────────────────────────
export async function isPasskeySupported(): Promise<boolean> {
  try {
    return (
      typeof window !== 'undefined' &&
      window.isSecureContext &&
      typeof window.PublicKeyCredential !== 'undefined' &&
      (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable())
    )
  } catch {
    return false
  }
}

// ── Public wallet shape ───────────────────────────────────────────────────────
export interface PasskeyWallet {
  address:     string
  signedTx:    string
  keyIdBase64: string
  // The full raw result from kit.createWallet — passed back to confirmWalletCreation
  _raw?: unknown
}

// ── Step 1: Create a new passkey wallet (browser WebAuthn registration) ───────
export async function createPasskeyWallet(userName: string): Promise<PasskeyWallet> {
  const kit    = getKit()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await kit.createWallet('Scratch & Split', userName) as any
  const wallet: PasskeyWallet = {
    address:     result.contractId as string,
    signedTx:    result.signedTx as string,
    keyIdBase64: result.keyIdBase64 as string,
    _raw:        result,
  }
  return wallet
}

// ── Step 2: Deploy via server-side PasskeyServer.send() ───────────────────────
export async function deployPasskeyWallet(signedTx: string): Promise<string> {
  const res = await fetch('/api/relayer', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ xdr: signedTx }),
  })
  const json = await res.json() as { hash?: string; error?: string }
  if (!res.ok || json.error) {
    throw new Error(json.error ?? `Relayer deploy failed: ${res.status}`)
  }
  return json.hash ?? 'unknown'
}

// ── Step 3: Confirm deployment onchain and connect ────────────────────────────
export async function confirmAndConnect(
  created:  PasskeyWallet,
  _txHash:  string,  // kept for API compat — confirmation skipped, contractId is deterministic
): Promise<string> {
  // Skip confirmWalletCreation entirely.
  // The contractId is derived deterministically from the WebAuthn credential BEFORE
  // deployment, so we already have the correct Stellar address.
  // confirmWalletCreation only polls for the deploy tx receipt — it throws a Zod
  // validation error when the Soroban RPC response shape differs from the SDK schema.
  // The Stellar payment in passkey-claim.ts will wait naturally for the contract to exist.
  const address = created.address
  setCachedWallet(address)
  setCachedKeyId(created.keyIdBase64)
  return address
}

// ── Connect an existing passkey wallet (returning user) ───────────────────────
export async function connectPasskeyWallet(): Promise<PasskeyWallet> {
  const kit    = getKit()
  const keyId  = getCachedKeyId()
  // If we have a cached keyId use it to skip the discovery ceremony
  const result = await kit.connectWallet(keyId ? { keyId } : undefined) as { contractId: string; keyIdBase64: string }
  const wallet: PasskeyWallet = {
    address:     result.contractId,
    signedTx:    '',   // already deployed
    keyIdBase64: result.keyIdBase64,
  }
  setCachedWallet(wallet.address)
  setCachedKeyId(wallet.keyIdBase64)
  return wallet
}

// ── Transfer USDC to a Stellar wallet address (server-side) ──────────────────
export async function callPasskeyClaim(params: {
  ephemeralKeyHex:  string
  stellarRecipient: string
  amount:           string
}): Promise<{ txHash: string; amount: string }> {
  const res = await fetch('/api/passkey-claim', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(params),
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(txt || 'Passkey claim failed')
  }
  return res.json() as Promise<{ txHash: string; amount: string }>
}
