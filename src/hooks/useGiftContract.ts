/**
 * useGiftContract — wagmi hooks for ScratchAndSplit contract interactions.
 * On Arc, msg.value IS USDC (18-decimal native). No ERC-20 approve needed.
 *
 * Supports ScratchAndSplit v3 (EIP-712 ephemeral keypair & signature claims)
 * with backward-compatible fallback to v2 commitment escrows.
 */
import { useState, useCallback, useEffect } from 'react'
import { useWaitForTransactionReceipt } from 'wagmi'
import { arcTestnet } from 'viem/chains'
import { useWallets } from '@privy-io/react-auth'
import { encodeFunctionData, parseUnits } from 'viem'
import {
  signClaimGift,
  getEphemeralAddress,
  secretKeyToHex,
} from '@/lib/giftCrypto'

export const CONTRACT_ADDRESS_V3 = (
  import.meta.env.VITE_SCRATCH_CONTRACT_V3 ??
  import.meta.env.VITE_SCRATCH_CONTRACT ??
  '0xB049c84b48C0F57eD2FCa32131E16036eaDcE6A7'
) as `0x${string}`

export const CONTRACT_ADDRESS_V2 = (
  import.meta.env.VITE_SCRATCH_CONTRACT_V2 ??
  '0x0b612a742aab5ed55b84c181af4258204e0d6dfc'
) as `0x${string}`

export const CHAIN_ID = arcTestnet.id

export const SCRATCH_V3_ABI = [
  {
    name: 'createGift',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'ephemeralSigner', type: 'address' },
      { name: 'expiresAt', type: 'uint64' },
    ],
    outputs: [],
  },
  {
    name: 'claimGift',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'recipient', type: 'address' },
      { name: 'ephemeralSigner', type: 'address' },
      { name: 'deadline', type: 'uint64' },
      { name: 'signature', type: 'bytes' },
    ],
    outputs: [],
  },
  {
    name: 'cancelGift',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'ephemeralSigner', type: 'address' }],
    outputs: [],
  },
  {
    name: 'refundGift',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'ephemeralSigner', type: 'address' }],
    outputs: [],
  },
  {
    name: 'getGift',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'ephemeralSigner', type: 'address' }],
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
      { name: 'ephemeralSigner', type: 'address', indexed: true },
      { name: 'sender', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'expiresAt', type: 'uint64', indexed: false },
    ],
  },
  {
    name: 'GiftClaimed',
    type: 'event',
    inputs: [
      { name: 'ephemeralSigner', type: 'address', indexed: true },
      { name: 'recipient', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'GiftCancelled',
    type: 'event',
    inputs: [
      { name: 'ephemeralSigner', type: 'address', indexed: true },
      { name: 'sender', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'GiftRefunded',
    type: 'event',
    inputs: [
      { name: 'ephemeralSigner', type: 'address', indexed: true },
      { name: 'sender', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
] as const

export const SCRATCH_V2_ABI = [
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
] as const

// Default export for backward compatibility
export const CONTRACT_ADDRESS = CONTRACT_ADDRESS_V3
export const SCRATCH_ABI = SCRATCH_V3_ABI

export type CreateStep = 'idle' | 'sending' | 'confirming' | 'success' | 'error'
export type ClaimStep = 'idle' | 'signing' | 'sending' | 'confirming' | 'success' | 'error'
export type CancelStep = 'idle' | 'sending' | 'confirming' | 'success' | 'error'
export type RefundStep = 'idle' | 'sending' | 'confirming' | 'success' | 'error'

/** Extract a readable revert reason or short error message from an RPC error. */
export function parseRpcError(err: unknown): string {
  if (!(err instanceof Error)) return 'Transaction failed'
  const msg = err.message
  if (msg.includes('insufficient funds for gas')) {
    return 'Your wallet has 0 USDC for gas. Please fund your wallet or use a sponsored relayer to claim.'
  }
  const revertMatch = msg.match(/reverted with reason:\s*(.+?)(?:\n|$|\{)/i)
  if (revertMatch) return revertMatch[1].trim()
  const customErrorMatch = msg.match(/reverted with custom error '([^']+)'/)
  if (customErrorMatch) return `Contract error: ${customErrorMatch[1]}`
  const detailMatch = msg.match(/"details":\s*"([^"]+)"/)
  if (detailMatch) return detailMatch[1]
  return msg.split('\n').find((l) => l.trim().length > 0) ?? 'Transaction failed'
}

export function useSendTx() {
  const { wallets } = useWallets()
  const privyWallet = wallets.find((w) => w.walletClientType === 'privy') ?? wallets[0]

  return useCallback(
    async (
      to: `0x${string}`,
      data: `0x${string}`,
      value?: bigint,
    ): Promise<`0x${string}`> => {
      if (!privyWallet) throw new Error('No wallet connected')
      const provider = await privyWallet.getEthereumProvider()
      const address = privyWallet.address as `0x${string}`
      const chainHex = `0x${CHAIN_ID.toString(16)}`

      try {
        await provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: chainHex }],
        })
      } catch (switchErr: unknown) {
        if ((switchErr as { code?: number }).code === 4902) {
          await provider.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: chainHex,
                chainName: 'Arc Testnet',
                nativeCurrency: { name: 'USD Coin', symbol: 'USDC', decimals: 18 },
                rpcUrls: ['https://rpc.testnet.arc.network'],
                blockExplorerUrls: ['https://explorer.testnet.arc.network'],
              },
            ],
          })
          await provider.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: chainHex }],
          })
        } else {
          throw switchErr
        }
      }

      const gas = `0x${(200_000).toString(16)}`
      const params: Record<string, string> = { from: address, to, data, chainId: chainHex, gas }
      if (value !== undefined) params.value = `0x${value.toString(16)}`
      return provider.request({ method: 'eth_sendTransaction', params: [params] }) as Promise<`0x${string}`>
    },
    [privyWallet],
  )
}

/**
 * Create a new gift escrow — locks msg.value USDC native to ephemeralSigner address (v3).
 */
export function useCreateGift(onSuccess?: (ephemeralAddress: `0x${string}`) => void) {
  const sendTx = useSendTx()
  const [step, setStep] = useState<CreateStep>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>()
  const [ephemeralAddress, setEphemeralAddress] = useState<`0x${string}` | undefined>()

  const { isSuccess: confirmed } = useWaitForTransactionReceipt({
    hash: txHash,
    chainId: CHAIN_ID,
    query: { enabled: Boolean(txHash) },
  })

  useEffect(() => {
    if (confirmed && step === 'confirming' && ephemeralAddress) {
      setStep('success')
      onSuccess?.(ephemeralAddress)
    }
  }, [confirmed, step, ephemeralAddress, onSuccess])

  const createGift = useCallback(
    async (
      ephemeralSignerOrKey: `0x${string}` | Uint8Array,
      amountUsdc: string,
      expiresInDays = 30,
    ) => {
      setStep('sending')
      setErrorMsg(null)
      try {
        let signerAddr: `0x${string}`
        if (typeof ephemeralSignerOrKey === 'string' && ephemeralSignerOrKey.startsWith('0x')) {
          signerAddr = getEphemeralAddress(ephemeralSignerOrKey)
        } else {
          const keyHex = secretKeyToHex(ephemeralSignerOrKey as Uint8Array)
          signerAddr = getEphemeralAddress(keyHex)
        }
        setEphemeralAddress(signerAddr)

        const expiresAt = BigInt(Math.floor(Date.now() / 1000) + expiresInDays * 86400)
        const value = parseUnits(amountUsdc, 18)

        // Try ScratchAndSplit v3 first
        const data = encodeFunctionData({
          abi: SCRATCH_V3_ABI,
          functionName: 'createGift',
          args: [signerAddr, expiresAt],
        })

        const hash = await sendTx(CONTRACT_ADDRESS_V3, data, value)
        setTxHash(hash)
        setStep('confirming')
      } catch (err: unknown) {
        setErrorMsg(parseRpcError(err))
        setStep('error')
      }
    },
    [sendTx],
  )

  return {
    createGift,
    step,
    errorMsg,
    txHash,
    ephemeralAddress,
    reset: () => {
      setStep('idle')
      setErrorMsg(null)
      setTxHash(undefined)
      setEphemeralAddress(undefined)
    },
  }
}

/**
 * Claim a gift using an EIP-712 signature produced by the ephemeral private key.
 * Can be relayed gaslessly or sent via connected wallet.
 */
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
  }, [confirmed, step, onSuccess])

  const claimGift = useCallback(
    async (
      secretKeyOrHex: Uint8Array | `0x${string}`,
      recipient: `0x${string}`,
      options?: { isLegacyV2?: boolean },
    ) => {
      setStep('signing')
      setErrorMsg(null)

      try {
        const privateKeyHex =
          typeof secretKeyOrHex === 'string'
            ? secretKeyOrHex
            : secretKeyToHex(secretKeyOrHex)

        if (options?.isLegacyV2) {
          // Fallback to legacy v2 claim
          setStep('sending')
          const data = encodeFunctionData({
            abi: SCRATCH_V2_ABI,
            functionName: 'claimGift',
            args: [privateKeyHex, recipient],
          })
          const hash = await sendTx(CONTRACT_ADDRESS_V2, data)
          setTxHash(hash)
          setStep('confirming')
          return
        }

        // V3: Produce EIP-712 signature locally in browser
        const { signature, deadline, ephemeralSigner } = await signClaimGift({
          privateKeyHex,
          recipient,
          contractAddress: CONTRACT_ADDRESS_V3,
          chainId: CHAIN_ID,
        })

        // Check if an external gasless relayer is configured
        const relayerUrl = import.meta.env.VITE_RELAYER_URL as string | undefined
        if (relayerUrl) {
          setStep('sending')
          const response = await fetch(`${relayerUrl}/api/relay`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              recipient,
              ephemeralSigner,
              deadline: deadline.toString(),
              signature,
            }),
          })
          if (!response.ok) {
            const relayerErr = await response.text()
            throw new Error(`Relayer failed: ${relayerErr}`)
          }
          const resJson = await response.json() as { txHash: `0x${string}` }
          setTxHash(resJson.txHash)
          setStep('confirming')
          return
        }

        // Direct submission via connected wallet (or embedded wallet)
        setStep('sending')
        const data = encodeFunctionData({
          abi: SCRATCH_V3_ABI,
          functionName: 'claimGift',
          args: [recipient, ephemeralSigner, deadline, signature],
        })

        const hash = await sendTx(CONTRACT_ADDRESS_V3, data)
        setTxHash(hash)
        setStep('confirming')
      } catch (err: unknown) {
        setErrorMsg(parseRpcError(err))
        setStep('error')
      }
    },
    [sendTx],
  )

  return {
    claimGift,
    step,
    errorMsg,
    txHash,
    reset: () => {
      setStep('idle')
      setErrorMsg(null)
      setTxHash(undefined)
    },
  }
}

/**
 * Cancel an unclaimed gift before expiry — original sender recovers funds immediately.
 */
export function useCancelGift(onSuccess?: () => void) {
  const sendTx = useSendTx()
  const [step, setStep] = useState<CancelStep>('idle')
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
  }, [confirmed, step, onSuccess])

  const cancelGift = useCallback(
    async (ephemeralSigner: `0x${string}`) => {
      setStep('sending')
      setErrorMsg(null)
      try {
        const data = encodeFunctionData({
          abi: SCRATCH_V3_ABI,
          functionName: 'cancelGift',
          args: [ephemeralSigner],
        })
        const hash = await sendTx(CONTRACT_ADDRESS_V3, data)
        setTxHash(hash)
        setStep('confirming')
      } catch (err: unknown) {
        setErrorMsg(parseRpcError(err))
        setStep('error')
      }
    },
    [sendTx],
  )

  return {
    cancelGift,
    step,
    errorMsg,
    txHash,
    reset: () => {
      setStep('idle')
      setErrorMsg(null)
      setTxHash(undefined)
    },
  }
}

/**
 * Refund an expired gift — permissionless call returning funds to gift.sender.
 */
export function useRefundGift(onSuccess?: () => void) {
  const sendTx = useSendTx()
  const [step, setStep] = useState<RefundStep>('idle')
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
  }, [confirmed, step, onSuccess])

  const refundGift = useCallback(
    async (identifier: `0x${string}`, isLegacyV2 = false) => {
      setStep('sending')
      setErrorMsg(null)
      try {
        const abi = isLegacyV2 ? SCRATCH_V2_ABI : SCRATCH_V3_ABI
        const targetContract = isLegacyV2 ? CONTRACT_ADDRESS_V2 : CONTRACT_ADDRESS_V3
        const data = encodeFunctionData({
          abi,
          functionName: 'refundGift',
          args: [identifier],
        })
        const hash = await sendTx(targetContract, data)
        setTxHash(hash)
        setStep('confirming')
      } catch (err: unknown) {
        setErrorMsg(parseRpcError(err))
        setStep('error')
      }
    },
    [sendTx],
  )

  return {
    refundGift,
    step,
    errorMsg,
    txHash,
    reset: () => {
      setStep('idle')
      setErrorMsg(null)
      setTxHash(undefined)
    },
  }
}
