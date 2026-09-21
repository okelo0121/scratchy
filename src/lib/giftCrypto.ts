/**
 * giftCrypto.ts — client-side cryptography for Scratch & Split gift cards.
 *
 * Bearer commit-reveal scheme:
 *   commitment = keccak256(abi.encodePacked(secretKey))
 *
 * The secretKey travels ONLY in the URL fragment (#<hex>) — never onchain,
 * never sent to any server. Anyone with the secret link can claim to any address.
 */
import { keccak256, bytesToHex, hexToBytes, encodePacked } from 'viem'

export const SECRET_KEY_BYTES = 32

/** Generate a cryptographically random 32-byte secret key. */
export function generateSecretKey(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(SECRET_KEY_BYTES))
}

/** Encode secretKey as a 0x-prefixed hex string for the URL fragment. */
export function secretKeyToHex(key: Uint8Array): `0x${string}` {
  return bytesToHex(key)
}

/** Decode a 0x-prefixed hex string back to a Uint8Array. */
export function hexToSecretKey(hex: string): Uint8Array {
  return hexToBytes(hex as `0x${string}`)
}

/**
 * Compute the onchain commitment:
 *   keccak256(abi.encodePacked(secretKey))
 *
 * Bearer gift — anyone with the secret link can claim to any address.
 * Must match what ScratchAndSplit.claimGift computes on-chain.
 */
export function computeCommitment(secretKey: Uint8Array): `0x${string}` {
  return keccak256(encodePacked(['bytes32'], [bytesToHex(secretKey)]))
}

/** Build the shareable gift URL — fragment never hits the server. */
export function buildGiftUrl(secretKey: Uint8Array, origin: string): string {
  return `${origin}/#gift-${secretKeyToHex(secretKey)}`
}

/**
 * Parse the secret key from the current URL fragment.
 * Returns null if the fragment doesn't contain a gift key.
 */
export function parseSecretKeyFromHash(hash: string): Uint8Array | null {
  const match = hash.match(/gift-(0x[0-9a-fA-F]{64})/)
  if (!match) return null
  try {
    return hexToSecretKey(match[1])
  } catch {
    return null
  }
}
