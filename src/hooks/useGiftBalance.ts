/**
 * useGiftBalance — reads a gift's onchain state by commitment.
 */
import { useReadContract } from 'wagmi'
import { arcTestnet } from 'viem/chains'
import { formatUnits } from 'viem'
import { CONTRACT_ADDRESS, SCRATCH_ABI } from './useGiftContract'

export function useGiftBalance(commitment: `0x${string}` | null) {
  const { data, isLoading, refetch } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: SCRATCH_ABI,
    functionName: 'getGift',
    args: [commitment ?? '0x0000000000000000000000000000000000000000000000000000000000000000'],
    chainId: arcTestnet.id,
    query: { enabled: Boolean(commitment), staleTime: 0 },
  })

  const raw = data as [string, bigint, bigint, boolean] | undefined

  const amountNative = raw?.[1] ?? 0n
  // Convert 18-decimal native to 6-decimal USDC display
  const amountUsdc = amountNative > 0n ? formatUnits(amountNative, 18) : null
  const expiresAt = raw?.[2] ? Number(raw[2]) * 1000 : null
  const claimed = raw?.[3] ?? false
  const exists = Boolean(raw?.[0] && raw[0] !== '0x0000000000000000000000000000000000000000')

  return { amountUsdc, expiresAt, claimed, exists, isLoading, refetch }
}
