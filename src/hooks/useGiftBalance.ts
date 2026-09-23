/**
 * useGiftBalance — reads a gift's onchain state.
 * Supports ScratchAndSplit v3 (ephemeral signer address) with automatic v2 fallback (commitment hash).
 */
import { useReadContract } from 'wagmi'
import { arcTestnet } from 'viem/chains'
import { formatUnits, isAddress } from 'viem'
import {
  CONTRACT_ADDRESS_V3,
  CONTRACT_ADDRESS_V2,
  SCRATCH_V3_ABI,
  SCRATCH_V2_ABI,
} from './useGiftContract'
import { getEphemeralAddress, computeCommitment, hexToSecretKey } from '@/lib/giftCrypto'

export function useGiftBalance(identifier: `0x${string}` | null) {
  // If identifier is a 32-byte private key (66 chars), derive its ephemeral public address
  let ephemeralAddress: `0x${string}` | undefined
  let legacyCommitment: `0x${string}` | undefined

  if (identifier) {
    const idStr = String(identifier)
    if (isAddress(idStr)) {
      ephemeralAddress = idStr as `0x${string}`
    } else if (idStr.length === 66) {
      try {
        ephemeralAddress = getEphemeralAddress(idStr as `0x${string}`)
        legacyCommitment = computeCommitment(hexToSecretKey(idStr as `0x${string}`))
      } catch {
        legacyCommitment = idStr as `0x${string}`
      }
    }
  }

  // 1. Query V3 contract
  const {
    data: v3Data,
    isLoading: v3Loading,
    refetch: v3Refetch,
  } = useReadContract({
    address: CONTRACT_ADDRESS_V3,
    abi: SCRATCH_V3_ABI,
    functionName: 'getGift',
    args: [ephemeralAddress ?? '0x0000000000000000000000000000000000000000'],
    chainId: arcTestnet.id,
    query: { enabled: Boolean(ephemeralAddress), staleTime: 0 },
  })

  const rawV3 = v3Data as [string, bigint, bigint, boolean] | undefined
  const v3Exists = Boolean(rawV3?.[0] && rawV3[0] !== '0x0000000000000000000000000000000000000000')

  // 2. Query legacy V2 contract if V3 is not found
  const {
    data: v2Data,
    isLoading: v2Loading,
    refetch: v2Refetch,
  } = useReadContract({
    address: CONTRACT_ADDRESS_V2,
    abi: SCRATCH_V2_ABI,
    functionName: 'getGift',
    args: [legacyCommitment ?? '0x0000000000000000000000000000000000000000000000000000000000000000'],
    chainId: arcTestnet.id,
    query: { enabled: Boolean(!v3Exists && legacyCommitment), staleTime: 0 },
  })

  const rawV2 = v2Data as [string, bigint, bigint, boolean] | undefined
  const v2Exists = Boolean(rawV2?.[0] && rawV2[0] !== '0x0000000000000000000000000000000000000000')

  const isV3 = v3Exists || !v2Exists
  const activeRaw = isV3 ? rawV3 : rawV2

  const amountNative = activeRaw?.[1] ?? 0n
  // Convert 18-decimal native to 6-decimal USDC display
  const amountUsdc = amountNative > 0n ? formatUnits(amountNative, 18) : null
  const expiresAt = activeRaw?.[2] ? Number(activeRaw[2]) * 1000 : null
  const claimed = activeRaw?.[3] ?? false
  const exists = v3Exists || v2Exists
  const isLoading = v3Loading || (Boolean(!v3Exists && legacyCommitment) && v2Loading)

  const refetch = async () => {
    await v3Refetch()
    await v2Refetch()
  }

  return {
    amountUsdc,
    expiresAt,
    claimed,
    exists,
    isV3,
    ephemeralAddress,
    legacyCommitment,
    isLoading,
    refetch,
  }
}
