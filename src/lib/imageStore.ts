/**
 * imageStore.ts — encode/store/retrieve gift photos.
 *
 * Photos are stored in sessionStorage keyed by commitment hex.
 * They travel with the gift URL encoded as a compressed data URI
 * in the URL fragment so the recipient sees the photo without
 * needing the sender's device.
 *
 * Max photo size after base64: ~800 KB to keep URLs manageable.
 */

// Keep fragments short enough for all browsers (≤ ~8 KB base64 payload)
const MAX_DIMENSION = 360
const JPEG_QUALITY  = 0.55
const STORAGE_PREFIX = 'ss_photo_'

/** Resize + compress a File to a base64 JPEG data URI. */
export async function processPhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const canvas = document.createElement('canvas')
      let { width, height } = img
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('No canvas context')); return }
      ctx.drawImage(img, 0, 0, width, height)
      resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY))
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')) }
    img.src = url
  })
}

/** Persist a photo data URI keyed by commitment hex. */
export function storePhoto(commitmentHex: string, dataUri: string): void {
  try {
    sessionStorage.setItem(STORAGE_PREFIX + commitmentHex, dataUri)
  } catch {
    // storage full — silently skip; gift works without photo
  }
}

/** Retrieve a stored photo by commitment hex. */
export function retrievePhoto(commitmentHex: string): string | null {
  return sessionStorage.getItem(STORAGE_PREFIX + commitmentHex)
}

// Safe limit to prevent SMS, WhatsApp, and Safari URL truncation
const MAX_URL_PAYLOAD_CHARS = 1800

/**
 * Encode photo + message into the URL fragment payload.
 * Format: gift-<secretKeyHex>-<base64(JSON)>
 */
export function encodeGiftPayload(
  secretKeyHex: string,
  message: string,
  photoDataUri: string | null,
): string {
  let p = photoDataUri ?? ''
  let payload = JSON.stringify({ m: message, p })
  let encoded = btoa(unescape(encodeURIComponent(payload)))

  // If payload exceeds safe URL limits for messaging apps, omit inline photo from fragment
  // (the sender's device still stores it in sessionStorage)
  if (encoded.length > MAX_URL_PAYLOAD_CHARS && p) {
    payload = JSON.stringify({ m: message, p: '' })
    encoded = btoa(unescape(encodeURIComponent(payload)))
  }

  return `gift-${secretKeyHex}-${encoded}`
}

/** Decode a gift payload from a URL fragment. */
export function decodeGiftPayload(fragment: string): {
  secretKeyHex: string
  message: string
  photoDataUri: string | null
} | null {
  // Fragment format: gift-<0x64hex>-<base64payload>
  const match = fragment.match(/^gift-(0x[0-9a-fA-F]{64})-(.+)$/)
  if (!match) {
    // Try short form (no payload — sender device only)
    const shortMatch = fragment.match(/^gift-(0x[0-9a-fA-F]{64})$/)
    if (shortMatch) return { secretKeyHex: shortMatch[1], message: '', photoDataUri: null }
    return null
  }
  try {
    const json = decodeURIComponent(escape(atob(match[2])))
    const parsed = JSON.parse(json) as { m?: string; p?: string }
    return {
      secretKeyHex: match[1],
      message: parsed.m ?? '',
      photoDataUri: parsed.p || null,
    }
  } catch {
    return null
  }
}
