/**
 * passkeyClient.ts
 *
 * Browser-side PasskeyKit instance for Stellar smart-wallet passkey claims.
 * This runs entirely in the browser — no private keys, no relayer secret.
 *
 * The relayer API key is kept server-side. The browser calls our
 * /api/relayer endpoint which forwards to OpenZeppelin Channels.
 */
import { PasskeyKit } from 'passkey-kit'
import { LocalStorageAdapter } from 'passkey-kit/storage'
import { Networks } from '@stellar/stellar-sdk'

// ── Config ─────────────────────────────────────────────────────────────────────
const STELLAR_RPC     = 'https://soroban-testnet.stellar.org'
const NETWORK_PHRASE  = Networks.TESTNET
// Canonical smart-wallet WASM hash for Stellar testnet (passkey-kit v0.19.1)
// Sourced from node_modules/passkey-kit/README.md — update when upgrading the package
const WALLET_WASM_HASH = '97ce047884106b1c6c3bb40b8973cc48db1c4dad95c9e20462bf2c701daa764e'

// ── Singleton kit instance ────────────────────────────────────────────────────
let _kit: PasskeyKit | null = null

function getKit(): PasskeyKit {
  if (_kit) return _kit
  _kit = new PasskeyKit({
    rpcUrl:           STELLAR_RPC,
    networkPassphrase: NETWORK_PHRASE,
    walletWasmHash:   WALLET_WASM_HASH,
    storage:          new LocalStorageAdapter(),
  })
  return _kit
}

// ── localStorage cache ────────────────────────────────────────────────────────
const CACHE_KEY = 'sas_stellar_wallet'

export function getCachedWallet(): string | null {
  try { return localStorage.getItem(CACHE_KEY) } catch { return null }
}

function setCachedWallet(addr: string) {
  try { localStorage.setItem(CACHE_KEY, addr) } catch { /* ignore */ }
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

// ── Create a new passkey wallet ───────────────────────────────────────────────
export interface PasskeyWallet {
  address: string
  signedTx: string   // base64 XDR — submit via relayer-proxy to deploy
  keyIdBase64: string
}

export async function createPasskeyWallet(userName: string): Promise<PasskeyWallet> {
  const kit = getKit()
  const result = await kit.createWallet('Scratch & Split', userName)
  const wallet: PasskeyWallet = {
    address:     result.contractId,
    signedTx:    result.signedTx,
    keyIdBase64: result.keyIdBase64,
  }
  setCachedWallet(wallet.address)
  return wallet
}

// ── Deploy the wallet via relayer-proxy ───────────────────────────────────────
export async function deployPasskeyWallet(signedTx: string): Promise<string> {
  const res = await fetch('/api/relayer', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ xdr: signedTx }),
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`Relayer deploy failed: ${txt}`)
  }
  const json = await res.json() as { hash?: string; transactionId?: string }
  return json.hash ?? json.transactionId ?? 'unknown'
}

// ── Connect an existing passkey wallet (returning user) ───────────────────────
export async function connectPasskeyWallet(): Promise<PasskeyWallet> {
  const kit = getKit()
  const result = await kit.connectWallet()
  const wallet: PasskeyWallet = {
    address:     result.contractId,
    signedTx:    '',   // already deployed
    keyIdBase64: result.keyIdBase64,
  }
  setCachedWallet(wallet.address)
  return wallet
}

// ── Transfer USDC to a Stellar wallet address ─────────────────────────────────
// This is done server-side via /api/passkey-claim. This helper just calls it.
export async function callPasskeyClaim(params: {
  ephemeralKeyHex: string
  stellarRecipient: string
  amount: string
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
