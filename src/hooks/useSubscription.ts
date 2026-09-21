/**
 * useSubscription — checks isPremium for the current user's wallet only.
 *
 * Only checks the embedded wallet created by Privy for this user.
 * External/injected wallets are deliberately excluded to prevent
 * cross-account premium leakage.
 */
import { useReadContract } from 'wagmi'
import { usePrivy, useWallets } from '@privy-io/react-auth'
import { arcTestnet } from 'viem/chains'

const CONTRACT_ADDRESS = '0xdb0e1558161f89599530c0874359fea9b9c1f75a' as const

const ABI = [
  {
    inputs: [{ internalType: 'address', name: 'user', type: 'address' }],
    name: 'isPremium',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: '', type: 'address' }],
    name: 'subscriptions',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'subscribe',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'to', type: 'address' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
    ],
    name: 'withdrawFees',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { indexed: true, internalType: 'address', name: 'user', type: 'address' },
      { indexed: false, internalType: 'uint256', name: 'expiryTimestamp', type: 'uint256' },
    ],
    name: 'Subscribed',
    type: 'event',
  },
] as const

export function useSubscription() {
  const { authenticated } = usePrivy()
  const { wallets } = useWallets()

  // Only use the embedded wallet — the first wallet Privy creates for this user.
  // Never pull in external/injected wallets to avoid cross-account premium leakage.
  const embeddedWallet = wallets.find((w) => w.walletClientType === 'privy')
  const address = embeddedWallet?.address as `0x${string}` | undefined

  const enabled = Boolean(authenticated && address)

  const { data: premiumBool, isLoading, refetch } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: ABI,
    functionName: 'isPremium',
    args: [address ?? '0x0000000000000000000000000000000000000000'],
    chainId: arcTestnet.id,
    query: { enabled, staleTime: 0, gcTime: 0 },
  })

  const { data: expiryRaw } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: ABI,
    functionName: 'subscriptions',
    args: [address ?? '0x0000000000000000000000000000000000000000'],
    chainId: arcTestnet.id,
    query: { enabled, staleTime: 0, gcTime: 0 },
  })

  const expiryTimestamp = expiryRaw ? Number(expiryRaw) * 1000 : null
  const expiryDate = expiryTimestamp ? new Date(expiryTimestamp) : null

  return {
    isPremium: Boolean(premiumBool),
    isLoading,
    expiryDate,
    refetch,
    address,
  }
}

export { CONTRACT_ADDRESS, ABI as SUBSCRIPTION_ABI }
