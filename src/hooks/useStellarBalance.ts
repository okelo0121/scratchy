/**
 * useStellarBalance — polls Stellar Testnet Horizon for USDC balance
 * on a Soroban smart wallet (C...) address.
 *
 * USDC on Stellar Testnet:
 *   Issuer: GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5
 *   Asset code: USDC
 */
import { useState, useEffect, useCallback } from 'react'

const HORIZON = 'https://horizon-testnet.stellar.org'
const USDC_ISSUER = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'
const POLL_MS = 8_000

interface StellarBalance {
  usdc: string          // human-readable, e.g. "2.0000000"
  xlm: string           // native XLM balance
  loading: boolean
  error: string | null
  lastUpdated: number   // timestamp ms
  refresh: () => void
}

interface HorizonBalance {
  asset_type: string
  asset_code?: string
  asset_issuer?: string
  balance: string
}

interface HorizonAccount {
  balances: HorizonBalance[]
}

export function useStellarBalance(address: string | null): StellarBalance {
  const [usdc, setUsdc] = useState('0.0000000')
  const [xlm, setXlm] = useState('0.0000000')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState(0)

  const fetch_ = useCallback(async () => {
    if (!address) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${HORIZON}/accounts/${encodeURIComponent(address)}`)
      if (res.status === 404) {
        // Account not yet funded / activated on Stellar
        setUsdc('0.0000000')
        setXlm('0.0000000')
        setLastUpdated(Date.now())
        return
      }
      if (!res.ok) throw new Error(`Horizon error ${res.status}`)
      const data = (await res.json()) as HorizonAccount
      const usdcBalance = data.balances.find(
        (b) => b.asset_code === 'USDC' && b.asset_issuer === USDC_ISSUER,
      )
      const xlmBalance = data.balances.find((b) => b.asset_type === 'native')
      setUsdc(usdcBalance?.balance ?? '0.0000000')
      setXlm(xlmBalance?.balance ?? '0.0000000')
      setLastUpdated(Date.now())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch balance')
    } finally {
      setLoading(false)
    }
  }, [address])

  // Initial fetch + poll
  useEffect(() => {
    void fetch_()
    if (!address) return
    const id = setInterval(() => { void fetch_() }, POLL_MS)
    return () => clearInterval(id)
  }, [address, fetch_])

  return { usdc, xlm, loading, error, lastUpdated, refresh: fetch_ }
}
