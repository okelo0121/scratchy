/**
 * useGiftContract — wagmi hooks for ScratchAndSplit contract interactions.
 * On Arc, msg.value IS USDC (18-decimal native). No ERC-20 approve needed.
 */
import { useState, useCallback, useEffect } from 'react'
import { useWaitForTransactionReceipt } from 'wagmi'
import { arcTestnet } from 'viem/chains'
import { useWallets } from '@privy-io/react-auth'
import { encodeFunctionData, parseUnits } from 'viem'
import { computeCommitment, secretKeyToHex } from '@/lib/giftCrypto'

export const CONTRACT_ADDRESS = (
  import.meta.env.VITE_SCRATCH_CONTRACT ?? '0x0b612a742aab5ed55b84c181af4258204e0d6dfc'
) as `0x${string}`

const CHAIN_ID = arcTestnet.id

export const SCRATCH_ABI = [
  {
    name: 'createGift',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'commitment', type: 'bytes32' },
      { name: 'expiresAt', type: 'uint64' },
    ],
    outputs: [],
  },
  {
    name: 'claimGift',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'secretKey', type: 'bytes32' },
      { name: 'recipient', type: 'address' },
    ],
    outputs: [],
  },
  {
    name: 'refundGift',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'commitment', type: 'bytes32' }],
    outputs: [],
  },
  {
    name: 'getGift',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'commitment', type: 'bytes32' }],
    outputs: [
      { name: 'sender', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'expiresAt', type: 'uint64' },
      { name: 'claimed', type: 'bool' },
    ],
  },
  {
    name: 'GiftCreated',
    type: 'event',
    inputs: [
      { name: 'commitment', type: 'bytes32', indexed: true },
      { name: 'sender', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'expiresAt', type: 'uint64', indexed: false },
    ],
  },
  {
    name: 'GiftClaimed',
    type: 'event',
    inputs: [
      { name: 'commitment', type: 'bytes32', indexed: true },
      { name: 'recipient', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
] as const

export type CreateStep = 'idle' | 'sending' | 'confirming' | 'success' | 'error'
export type ClaimStep = 'idle' | 'sending' | 'confirming' | 'success' | 'error'

function useSendTx() {
  const { wallets } = useWallets()
  const privyWallet = wallets.find((w) => w.walletClientType === 'privy') ?? wallets[0]

  return useCallback(async (
    to: `0x${string}`,
    data: `0x${string}`,
    value?: bigint,
  ): Promise<`0x${string}`> => {
    if (!privyWallet) throw new Error('No wallet connected')
    const provider = await privyWallet.getEthereumProvider()
    const address = privyWallet.address as `0x${string}`
    const chainHex = `0x${CHAIN_ID.toString(16)}`
    const params: Record<string, string> = { from: address, to, data, chainId: chainHex }
    if (value !== undefined) params.value = `0x${value.toString(16)}`
    return provider.request({ method: 'eth_sendTransaction', params: [params] }) as Promise<`0x${string}`>
  }, [privyWallet])
}

/** Create a new gift escrow — sends msg.value USDC native. */
export function useCreateGift(onSuccess?: (commitment: `0x${string}`) => void) {
  const sendTx = useSendTx()
  const [step, setStep] = useState<CreateStep>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>()
  const [commitment, setCommitment] = useState<`0x${string}` | undefined>()

  const { isSuccess: confirmed } = useWaitForTransactionReceipt({
    hash: txHash,
    chainId: CHAIN_ID,
    query: { enabled: Boolean(txHash) },
  })

  useEffect(() => {
    if (confirmed && step === 'confirming' && commitment) {
      setStep('success')
      onSuccess?.(commitment)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmed, step, commitment])

  const createGift = useCallback(async (
    secretKey: Uint8Array,
    amountUsdc: string,   // e.g. "5.00" — 6-decimal display
    expiresInDays = 30,
  ) => {
    setStep('sending')
    setErrorMsg(null)
    try {
      const comm = computeCommitment(secretKey)
      setCommitment(comm)
      const expiresAt = BigInt(Math.floor(Date.now() / 1000) + expiresInDays * 86400)
      // Convert 6-decimal USDC display to 18-decimal native value
      const value = parseUnits(amountUsdc, 18)
      const data = encodeFunctionData({
        abi: SCRATCH_ABI,
        functionName: 'createGift',
        args: [comm, expiresAt],
      })
      const hash = await sendTx(CONTRACT_ADDRESS, data, value)
      setTxHash(hash)
      setStep('confirming')
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message.split('\n')[0] : 'Transaction failed')
      setStep('error')
    }
  }, [sendTx])

  return {
    createGift,
    step,
    errorMsg,
    txHash,
    commitment,
    reset: () => { setStep('idle'); setErrorMsg(null); setTxHash(undefined); setCommitment(undefined) },
  }
}

/** Claim a gift — recipient gets the USDC. */
export function useClaimGift(onSuccess?: () => void) {
  const sendTx = useSendTx()
  const [step, setStep] = useState<ClaimStep>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>()

  const { isSuccess: confirmed } = useWaitForTransactionReceipt({
    hash: txHash,
    chainId: CHAIN_ID,
    query: { enabled: Boolean(txHash) },
  })

  useEffect(() => {
    if (confirmed && step === 'confirming') {
      setStep('success')
      onSuccess?.()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmed, step])

  const claimGift = useCallback(async (
    secretKey: Uint8Array,
    recipient: `0x${string}`,
  ) => {
    setStep('sending')
    setErrorMsg(null)
    try {
      const data = encodeFunctionData({
        abi: SCRATCH_ABI,
        functionName: 'claimGift',
        args: [secretKeyToHex(secretKey), recipient],
      })
      const hash = await sendTx(CONTRACT_ADDRESS, data)
      setTxHash(hash)
      setStep('confirming')
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message.split('\n')[0] : 'Claim failed')
      setStep('error')
    }
  }, [sendTx])

  return {
    claimGift,
    step,
    errorMsg,
    txHash,
    reset: () => { setStep('idle'); setErrorMsg(null); setTxHash(undefined) },
  }
}
