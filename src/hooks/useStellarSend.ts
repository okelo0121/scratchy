/**
 * useStellarSend — build + sign + submit a Stellar USDC payment
 * from a passkey smart wallet via the /api/relayer endpoint.
 *
 * The passkey-kit client builds the transaction (using the cached keyId),
 * signs it with the user's biometric, and the result is submitted through
 * the server-side PasskeyServer.send() relay.
 */
import { useState, useCallback } from 'react'
import { getCachedKeyId } from '@/lib/passkeyClient'
import { PasskeyKit } from 'passkey-kit'

// Browser-side kit instance (same config as passkeyClient but local — avoids exporting kit)
const _kit = new PasskeyKit({
  rpcUrl: 'https://soroban-testnet.stellar.org',
  networkPassphrase: 'Test SDF Network ; September 2015',
  walletWasmHash: 'b2e858176fab112cc9afbe54590e13d12192ba7fa32dd83cf565d21f2f13179a',
})

const USDC_ISSUER = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'

type SendStep = 'idle' | 'building' | 'signing' | 'submitting' | 'success' | 'error'

interface SendResult {
  step: SendStep
  txHash: string | null
  error: string | null
  send: (params: { from: string; to: string; amount: string }) => Promise<void>
  reset: () => void
}

export function useStellarSend(): SendResult {
  const [step, setStep] = useState<SendStep>('idle')
  const [txHash, setTxHash] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const send = useCallback(async ({ from, to, amount }: { from: string; to: string; amount: string }) => {
    setStep('building')
    setError(null)
    setTxHash(null)
    try {
      const keyId = getCachedKeyId()
      if (!keyId) throw new Error('No passkey found — please reconnect your wallet')

      // Build a Stellar USDC transfer using passkey-kit's transfer helper
      setStep('signing')

      // _kit.transfer builds and signs the transaction using the stored passkey
      // Parameters: keyId, from (contractId), to, asset, amount
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const built = await (_kit as unknown as {
        transfer: (params: {
          keyId: string
          from: string
          to: string
          token: string
          amount: bigint
        }) => Promise<{ signedTx: string }>
      }).transfer({
        keyId,
        from,
        to,
        token: `${USDC_ISSUER}:USDC`,
        // Stellar USDC has 7 decimals on Stellar
        amount: BigInt(Math.round(parseFloat(amount) * 1e7)),
      })

      setStep('submitting')
      const res = await fetch('/api/relayer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ xdr: built.signedTx }),
      })
      const json = await res.json() as { hash?: string; error?: string }
      if (!res.ok || json.error) throw new Error(json.error ?? 'Submit failed')

      setTxHash(json.hash ?? null)
      setStep('success')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Send failed')
      setStep('error')
    }
  }, [])

  const reset = useCallback(() => {
    setStep('idle')
    setTxHash(null)
    setError(null)
  }, [])

  return { step, txHash, error, send, reset }
}
