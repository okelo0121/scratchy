/**
 * useUnlockPremium — drives the USDC approve + subscribe flow.
 * Uses Privy's embedded wallet sendTransaction directly so it works
 * whether the user has an injected wallet or a Privy embedded wallet.
 */
import { useEffect, useCallback, useRef, useState } from 'react'
import { useWaitForTransactionReceipt, useAccount, useSwitchChain, useReadContract } from 'wagmi'
import { encodeFunctionData, erc20Abi } from 'viem'
import { arcTestnet } from 'viem/chains'
import { useWallets, useCreateWallet } from '@privy-io/react-auth'
import { getUsdc } from '@/onchain-facts'
import { parseAmount, Amount, usdcDecimalsFor } from '@/onchain-money'
import { CONTRACT_ADDRESS, SUBSCRIPTION_ABI } from './useSubscription'

const CHAIN_ID = arcTestnet.id
const MONTHLY_FEE_USDC = '5'

const usdc = getUsdc(CHAIN_ID)
if (!usdc) throw new Error('USDC not found on Arc Testnet')
const USDC_ADDRESS = usdc.address as `0x${string}`

export type UnlockStep = 'idle' | 'approve' | 'approving' | 'subscribe' | 'subscribing' | 'success' | 'error'

export function useUnlockPremium(onSuccess?: () => void) {
  const { chainId } = useAccount()
  const { wallets } = useWallets()
  const { createWallet } = useCreateWallet()
  const { switchChain } = useSwitchChain()

  // Always use the Privy embedded wallet — never the external/injected wallet
  const privyWallet = wallets.find((w) => w.walletClientType === 'privy') ?? wallets[0]
  const address = privyWallet?.address as `0x${string}` | undefined

  const [step, setStep] = useState<UnlockStep>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [approveTxHash, setApproveTxHash] = useState<`0x${string}` | undefined>()
  const [subscribeTxHash, setSubscribeTxHash] = useState<`0x${string}` | undefined>()
  const approveThisSession = useRef(false)

  const feeAmount = parseAmount(CHAIN_ID, MONTHLY_FEE_USDC)

  // USDC balance
  const { data: usdcBalance } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [address ?? '0x0000000000000000000000000000000000000000'],
    chainId: CHAIN_ID,
    query: { enabled: Boolean(address) },
  })

  // USDC allowance — always fresh
  const { refetch: refetchAllowance } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [
      address ?? '0x0000000000000000000000000000000000000000',
      CONTRACT_ADDRESS,
    ],
    chainId: CHAIN_ID,
    query: { enabled: Boolean(address), staleTime: 0 },
  })

  // Wait for approve tx
  const { isLoading: isApprovingTx, isSuccess: approveConfirmed } = useWaitForTransactionReceipt({
    hash: approveTxHash,
    chainId: CHAIN_ID,
    query: { enabled: Boolean(approveTxHash) },
  })

  // Wait for subscribe tx
  const { isLoading: isSubscribingTx, isSuccess: subscribeConfirmed } = useWaitForTransactionReceipt({
    hash: subscribeTxHash,
    chainId: CHAIN_ID,
    query: { enabled: Boolean(subscribeTxHash) },
  })

  // Send via Privy embedded wallet (or fall back to wagmi injected wallet)
  const sendTx = useCallback(async (to: `0x${string}`, data: `0x${string}`) => {
    // Prefer Privy embedded wallet sendTransaction — works for both embedded and external
    if (privyWallet) {
      const provider = await privyWallet.getEthereumProvider()
      const hash = await provider.request({
        method: 'eth_sendTransaction',
        params: [{ from: address, to, data, chainId: `0x${CHAIN_ID.toString(16)}` }],
      }) as `0x${string}`
      return hash
    }
    throw new Error('No wallet available')
  }, [privyWallet, address])

  // After approve confirms → fire subscribe
  useEffect(() => {
    if (!approveConfirmed || !approveThisSession.current) return
    if (step === 'subscribe' || step === 'subscribing' || step === 'success') return
    approveThisSession.current = false
    setStep('subscribe')
    const data = encodeFunctionData({ abi: SUBSCRIPTION_ABI, functionName: 'subscribe' })
    sendTx(CONTRACT_ADDRESS, data)
      .then((hash) => {
        setSubscribeTxHash(hash)
        setStep('subscribing')
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message.split('\n')[0] : 'Subscribe failed'
        setErrorMsg(msg)
        setStep('error')
      })
  }, [approveConfirmed, step, sendTx])

  // Subscribe confirmed → success
  useEffect(() => {
    if (subscribeConfirmed && step === 'subscribing') {
      setStep('success')
      onSuccess?.()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscribeConfirmed, step])

  const doSubscribe = useCallback(() => {
    setStep('subscribe')
    const data = encodeFunctionData({ abi: SUBSCRIPTION_ABI, functionName: 'subscribe' })
    sendTx(CONTRACT_ADDRESS, data)
      .then((hash) => {
        setSubscribeTxHash(hash)
        setStep('subscribing')
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message.split('\n')[0] : 'Subscribe failed'
        setErrorMsg(msg)
        setStep('error')
      })
  }, [sendTx])

  const unlock = useCallback(() => {
    // If no wallet exists yet (createOnLogin: 'off'), create one first then retry
    if (!privyWallet && wallets.length === 0) {
      void createWallet().catch(() => {
        setErrorMsg('Could not create wallet. Please try again.')
        setStep('error')
      })
      return
    }
    if (!address) return
    if (chainId !== CHAIN_ID) {
      switchChain({ chainId: CHAIN_ID })
      return
    }

    setErrorMsg(null)
    setApproveTxHash(undefined)
    setSubscribeTxHash(undefined)
    approveThisSession.current = false

    void refetchAllowance().then((result) => {
      const freshAllowance = result.data
      const hasAllowance = freshAllowance !== undefined && freshAllowance >= feeAmount.raw

      if (hasAllowance) {
        doSubscribe()
      } else {
        approveThisSession.current = true
        setStep('approve')
        const data = encodeFunctionData({
          abi: erc20Abi,
          functionName: 'approve',
          args: [CONTRACT_ADDRESS, feeAmount.raw],
        })
        sendTx(USDC_ADDRESS, data)
          .then((hash) => {
            setApproveTxHash(hash)
            setStep('approving')
          })
          .catch((err: unknown) => {
            const msg = err instanceof Error ? err.message.split('\n')[0] : 'Approval failed'
            setErrorMsg(msg)
            setStep('error')
          })
      }
    })
  }, [address, chainId, feeAmount.raw, refetchAllowance, sendTx, doSubscribe, switchChain, privyWallet, wallets, createWallet])

  const formattedBalance = usdcBalance !== undefined
    ? Amount.fromRaw(usdcBalance, usdcDecimalsFor(CHAIN_ID)).toFixed(2)
    : null

  const isProcessing =
    step === 'approving' || step === 'subscribing' ||
    isApprovingTx || isSubscribingTx

  return {
    unlock,
    step,
    isProcessing,
    isApprovingTx,
    isSubscribingTx,
    approveConfirmed,
    subscribeConfirmed,
    approveTxHash,
    subscribeTxHash,
    errorMsg,
    usdcBalance,
    formattedBalance,
    feeAmount,
    needsChainSwitch: Boolean(chainId && chainId !== CHAIN_ID),
    resetStep: () => {
      setStep('idle')
      setErrorMsg(null)
      approveThisSession.current = false
      setApproveTxHash(undefined)
      setSubscribeTxHash(undefined)
    },
  }
}
