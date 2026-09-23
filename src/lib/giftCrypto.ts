/**
 * giftCrypto.ts — client-side cryptography for Scratch & Split gift cards.
 *
 * Ephemeral Keypair + EIP-712 Signature Claim Scheme (ScratchAndSplit v3):
 *   - Senders generate an ephemeral private key; funds are locked onchain to its public address.
 *   - The private key travels ONLY in the URL fragment (#gift-<privateKeyHex>-<payload>).
 *   - When claiming, the recipient provides their target address (0xRecipient).
 *   - The browser signs an EIP-712 typed ClaimGift message bound to 0xRecipient.
 *   - This signature allows permissionless, gasless relaying without risk of front-running.
 *
 * Also maintains backward compatibility with legacy v2 hash commitments:
 *   commitment = keccak256(abi.encodePacked(secretKey))
 */
import {
  keccak256,
  bytesToHex,
  hexToBytes,
  encodePacked,
} from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'

export const SECRET_KEY_BYTES = 32

export const EIP712_DOMAIN_NAME = 'ScratchAndSplit'
export const EIP712_DOMAIN_VERSION = '3'

export const CLAIM_TYPES = {
  ClaimGift: [
    { name: 'recipient', type: 'address' },
    { name: 'ephemeralSigner', type: 'address' },
    { name: 'deadline', type: 'uint64' },
  ],
} as const

export interface EphemeralKeypair {
  privateKey: `0x${string}`
  address: `0x${string}`
}

/** Generate a cryptographically secure ephemeral keypair. */
export function generateEphemeralKeypair(): EphemeralKeypair {
  const privateKey = generatePrivateKey()
  const account = privateKeyToAccount(privateKey)
  return {
    privateKey,
    address: account.address,
  }
}

/** Legacy secret key generator (retained for backward compatibility). */
export function generateSecretKey(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(SECRET_KEY_BYTES))
}

/** Convert a raw private key / secret key bytes to a 0x hex string. */
export function secretKeyToHex(key: Uint8Array): `0x${string}` {
  return bytesToHex(key)
}

/** Decode a 0x-prefixed hex string back to bytes. */
export function hexToSecretKey(hex: string): Uint8Array {
  return hexToBytes(hex as `0x${string}`)
}

/**
 * Derives the public address from an ephemeral private key hex.
 */
export function getEphemeralAddress(privateKeyHex: `0x${string}`): `0x${string}` {
  const account = privateKeyToAccount(privateKeyHex)
  return account.address
}

/**
 * Signs an EIP-712 ClaimGift message with the ephemeral private key.
 * The signature cryptographically binds the claim to `recipient`, preventing any
 * mempool attacker or relayer from redirecting the funds.
 */
export async function signClaimGift({
  privateKeyHex,
  recipient,
  contractAddress,
  chainId,
  deadlineSeconds = 3600, // 1 hour valid
}: {
  privateKeyHex: `0x${string}`
  recipient: `0x${string}`
  contractAddress: `0x${string}`
  chainId: number
  deadlineSeconds?: number
}): Promise<{ signature: `0x${string}`; deadline: bigint; ephemeralSigner: `0x${string}` }> {
  const account = privateKeyToAccount(privateKeyHex)
  const deadline = BigInt(Math.floor(Date.now() / 1000) + deadlineSeconds)

  const signature = await account.signTypedData({
    domain: {
      name: EIP712_DOMAIN_NAME,
      version: EIP712_DOMAIN_VERSION,
      chainId: BigInt(chainId),
      verifyingContract: contractAddress,
    },
    types: CLAIM_TYPES,
    primaryType: 'ClaimGift',
    message: {
      recipient,
      ephemeralSigner: account.address,
      deadline,
    },
  })

  return {
    signature,
    deadline,
    ephemeralSigner: account.address,
  }
}

/**
 * Compute legacy onchain commitment (v2 compatibility):
 *   keccak256(abi.encodePacked(secretKey))
 */
export function computeCommitment(secretKey: Uint8Array): `0x${string}` {
  return keccak256(encodePacked(['bytes32'], [bytesToHex(secretKey)]))
}

/** Build the shareable gift URL. */
export function buildGiftUrl(privateKeyHex: `0x${string}`, origin: string): string {
  return `${origin}/#gift-${privateKeyHex}`
}

/**
 * Parse the secret / private key from the current URL fragment.
 * Supports:
 *   #gift-0x<64 hex chars>
 *   #gift-0x<64 hex chars>-<payload>
 */
export function parseSecretKeyHexFromHash(hash: string): `0x${string}` | null {
  const match = hash.match(/gift-(0x[0-9a-fA-F]{64})/)
  return match ? (match[1] as `0x${string}`) : null
}

export function parseSecretKeyFromHash(hash: string): Uint8Array | null {
  const hex = parseSecretKeyHexFromHash(hash)
  if (!hex) return null
  try {
    return hexToSecretKey(hex)
  } catch {
    return null
  }
}
