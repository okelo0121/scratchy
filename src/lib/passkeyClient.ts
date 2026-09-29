/**
 * passkeyClient.ts — Browser-side PasskeyKit integration for Scratch & Split.
 *
 * Uses passkey-kit@0.19.1 with the security-patched WASM hash.
 * The WASM hash b2e858... is the fixed version (policy signer bypass closed).
 * The OZ Relayer enforces this hash and rejects older vulnerable hashes.
 */

import { PasskeyKit } from 'passkey-kit'
import { LocalStorageAdapter } from 'passkey-kit/storage'

// ── Constants ────────────────────────────────────────────────────────────────
const RPC_URL          = 'https://soroban-testnet.stellar.org'
const NETWORK_PHRASE   = 'Test SDF Network ; September 2015'
// Security-patched WASM hash — OZ Relayer rejects the old fdefad64 hash
const WALLET_WASM_HASH = 'b2e858176fab112cc9afbe54590e13d12192ba7fa32dd83cf565d21f2f13179a'
const STORAGE_KEY      = 'sas_stellar_wallet'
const KEYID_KEY        = 'sas_stellar_keyid'

// ── Types ────────────────────────────────────────────────────────────────────
export interface PasskeyWallet {
  address:     string   // Stellar smart-wallet contract address (C...)
  signedTx:    string   // Base64 XDR of the signed deployment transaction
  keyIdBase64: string   // Base64URL credential id for reconnect
  _raw:        unknown  // Raw CreateWalletResult for confirmWalletCreation
}

// ── Kit singleton ────────────────────────────────────────────────────────────
let _kit: PasskeyKit | null = null

export function getKit(): PasskeyKit {
  if (!_kit) {
    _kit = new PasskeyKit({
      rpcUrl:            RPC_URL,
      networkPassphrase: NETWORK_PHRASE,
      walletWasmHash:    WALLET_WASM_HASH,
      storage:           new LocalStorageAdapter(),
    })
  }
  return _kit
}

// ── Local storage helpers ────────────────────────────────────────────────────
export function getCachedWallet(): string | null {
  return localStorage.getItem(STORAGE_KEY)
}
export function setCachedWallet(address: string): void {
  localStorage.setItem(STORAGE_KEY, address)
}
export function getCachedKeyId(): string | null {
  return localStorage.getItem(KEYID_KEY)
}
export function setCachedKeyId(keyId: string): void {
  localStorage.setItem(KEYID_KEY, keyId)
}

// ── Feature detection ────────────────────────────────────────────────────────
export function isPasskeySupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.PublicKeyCredential !== 'undefined' &&
    window.self === window.top // not inside an iframe
  )
}

// ── Step 1: WebAuthn registration + build deployment tx ───────────────────────
export async function createPasskeyWallet(userName: string): Promise<PasskeyWallet> {
  const kit    = getKit()
  const result = await kit.createWallet('Scratch & Split', userName)
  return {
    address:     (result as { contractId: string }).contractId,
    signedTx:    (result as { signedTx: string }).signedTx,
    keyIdBase64: (result as { keyIdBase64: string }).keyIdBase64,
    _raw:        result,
  }
}

// ── Step 2: Submit deployment via server-side PasskeyServer ───────────────────
export async function deployPasskeyWallet(signedTx: string): Promise<string> {
  const res  = await fetch('/api/relayer', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ action: 'submit', xdr: signedTx }),
  })
  const data = await res.json() as { hash?: string; error?: string }
  if (!res.ok || !data.hash) throw new Error(data.error ?? 'Relay failed')
  return data.hash
}

// ── Step 3: Cache wallet address (no confirmWalletCreation — address is deterministic)
export function confirmAndConnect(created: PasskeyWallet, _txHash: string): string {
  setCachedWallet(created.address)
  setCachedKeyId(created.keyIdBase64)
  return created.address
}

// ── Reconnect returning user ──────────────────────────────────────────────────
export async function reconnectPasskeyWallet(): Promise<string | null> {
  const cached = getCachedWallet()
  if (cached) return cached
  try {
    const kit    = getKit()
    const result = await kit.connectWallet()
    const id     = (result as { contractId?: string }).contractId
    if (id) { setCachedWallet(id); return id }
  } catch { /* user cancelled */ }
  return null
}

// ── Server claim + Stellar USDC send ─────────────────────────────────────────
// Field names must match api/passkey-claim.ts:
//   { ephemeralKeyHex, stellarRecipient, amount?, giftId? }
export async function callPasskeyClaim(params: {
  secretKey:     string   // ephemeral private key hex (0x prefix optional)
  stellarWallet: string   // C... or G... Stellar passkey wallet
  amount:        string   // display amount — server pays the on-chain amount
  giftId?:       string
}): Promise<{ stellarTxHash: string; arcTxHash: string | null; amount: string }> {
  const res  = await fetch('/api/passkey-claim', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      ephemeralKeyHex:  params.secretKey,
      stellarRecipient: params.stellarWallet,
      amount:           params.amount,
      giftId:           params.giftId,
    }),
  })
  const data = await res.json() as {
    txHash?: string
    stellarTxHash?: string
    arcTxHash?: string | null
    amount?: string
    error?: string
  }
  const stellarTxHash = data.stellarTxHash ?? data.txHash
  if (!res.ok || !stellarTxHash) throw new Error(data.error ?? 'Passkey claim failed')
  return { stellarTxHash, arcTxHash: data.arcTxHash ?? null, amount: data.amount ?? params.amount }
}
