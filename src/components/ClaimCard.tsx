/**
 * ClaimCard — claim flow with EIP-712 signature verification.
 *
 * Paths:
 *   A) Already signed in + embedded wallet → sign & claim immediately to embedded wallet
 *   B) Not signed in → Privy login → wait for embedded wallet → auto-sign & claim
 *   C) External wallet address → paste 0x address → claim directly to that address
 *
 * NOTE: With ScratchAndSplit v3, claims are secured by EIP-712 typed signatures.
 * The destination address is cryptographically locked in the signature, eliminating
 * mempool front-running and allowing gasless relaying.
 */
import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePrivy, useWallets } from '@privy-io/react-auth'
import { isAddress } from 'viem'
import {
  createPasskeyWallet,
  connectPasskeyWallet,
  deployPasskeyWallet,
  confirmAndConnect,
  callPasskeyClaim,
  getCachedWallet,
  isPasskeySupported,
} from '@/lib/passkeyClient'
import MascotSVG from './MascotSVG'
import TxStatusBadge from './TxStatusBadge'

interface Props {
  secretKey: Uint8Array | `0x${string}`
  amountUsdc: string | null
  isLegacyV2?: boolean
  onSuccess: () => void
}

export default function ClaimCard({ secretKey, amountUsdc, isLegacyV2: _isLegacyV2 = false, onSuccess }: Props) {
  const { authenticated, login } = usePrivy()
  const { wallets } = useWallets()
  const embeddedWallet = wallets.find((w) => w.walletClientType === 'privy')
  const embeddedAddress = embeddedWallet?.address as `0x${string}` | undefined

  const [mode, setMode] = useState<'choose' | 'external' | 'passkey'>('choose')
  const [externalAddr, setExternalAddr] = useState('')
  const [waitingForWallet, setWaiting] = useState(false)
  const autoClaimedRef = useRef(false)
  const addrValid = isAddress(externalAddr)

  // Server-side gasless claim state
  const [claimStep, setClaimStep] = useState<'idle' | 'signing' | 'sending' | 'confirming' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)

  async function serverClaim(recipientAddress: string) {
    setClaimStep('signing')
    setErrorMsg(null)
    try {
      const ephemeralKeyHex: string =
        typeof secretKey === 'string'
          ? secretKey.replace(/^0x/, '')
          : Array.from(secretKey).map((b) => b.toString(16).padStart(2, '0')).join('')

      setClaimStep('sending')
      const res = await fetch('/api/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ephemeralKeyHex, recipientAddress }),
      })
      const json = await res.json() as { txHash?: string; amount?: string; error?: string }
      if (!res.ok || json.error) throw new Error(json.error ?? 'Claim failed')

      setClaimStep('confirming')
      setTxHash(json.txHash ?? null)
      setClaimStep('success')

      // Persist to local activity
      try {
        const existing = JSON.parse(localStorage.getItem('sas_received_gifts') ?? '[]') as Array<{
          amount: string; sender?: string; date: string; txHash?: string
        }>
        if (!existing.some((g) => g.txHash === json.txHash)) {
          localStorage.setItem('sas_received_gifts', JSON.stringify([
            ...existing,
            { amount: json.amount ?? amountUsdc ?? '0', sender: 'Mystery Friend', date: new Date().toLocaleDateString(), txHash: json.txHash },
          ]))
        }
      } catch { /* ignore */ }

      onSuccess()
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Claim failed')
      setClaimStep('error')
    }
  }

  function resetClaim() {
    setClaimStep('idle')
    setErrorMsg(null)
    setTxHash(null)
  }

  // Passkey state
  const [passkeySupported, setPasskeySupported] = useState(false)
  const [passkeyStep, setPasskeyStep] = useState<
    'idle' | 'registering' | 'deploying' | 'claiming' | 'bridging' | 'success' | 'error'
  >('idle')
  const [passkeyError, setPasskeyError] = useState<string | null>(null)
  const [stellarWallet, setStellarWallet] = useState<string | null>(() => getCachedWallet())
  const [stellarTxHash, setStellarTxHash] = useState<string | null>(null)
  const hasCachedWallet = Boolean(stellarWallet)

  useEffect(() => {
    void isPasskeySupported().then(setPasskeySupported)
  }, [])

  const isPending = claimStep === 'signing' || claimStep === 'sending' || claimStep === 'confirming'

  // After Privy login, wait for embedded wallet then auto-claim to that wallet
  useEffect(() => {
    if (!waitingForWallet || autoClaimedRef.current) return
    if (!embeddedAddress) return
    autoClaimedRef.current = true
    void serverClaim(embeddedAddress)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waitingForWallet, embeddedAddress])

  async function handlePasskeyClaim() {
    setPasskeyError(null)
    try {
      // Step 1: Register or connect passkey wallet
      let walletAddress: string
      if (hasCachedWallet && stellarWallet) {
        setPasskeyStep('deploying')
        const connected = await connectPasskeyWallet()
        walletAddress = connected.address
      } else {
        setPasskeyStep('registering')
        const created = await createPasskeyWallet('Gift Recipient')
        // Deploy wallet contract via server-side PasskeyServer.send()
        setPasskeyStep('deploying')
        const deployTxHash = await deployPasskeyWallet(created.signedTx)
        // Confirm deployment onchain and connect with keyId (no second prompt)
        walletAddress = confirmAndConnect(created, deployTxHash)
      }
      setStellarWallet(walletAddress)

      // Get the ephemeral private key hex from the secretKey prop
      const ephemeralKeyHex: string =
        typeof secretKey === 'string'
          ? secretKey
          : Array.from(secretKey)
              .map((b) => b.toString(16).padStart(2, '0'))
              .join('')

      // Step 2+3: Server claims on Arc, bridges to Stellar, sends to passkey wallet
      setPasskeyStep('claiming')
      const result = await callPasskeyClaim({
        ephemeralKeyHex,
        stellarRecipient: walletAddress,
        amount: amountUsdc ?? '0',
      })
      setStellarTxHash(result.txHash)
      setPasskeyStep('success')

      // Persist to activity
      try {
        const existing = JSON.parse(localStorage.getItem('sas_received_gifts') ?? '[]') as Array<{
          amount: string; sender?: string; date: string; txHash?: string
        }>
        localStorage.setItem('sas_received_gifts', JSON.stringify([
          ...existing,
          { amount: result.amount, sender: 'Mystery Friend', date: new Date().toLocaleDateString(), txHash: result.txHash },
        ]))
      } catch { /* ignore */ }

    } catch (err: unknown) {
      setPasskeyError(err instanceof Error ? err.message : 'Something went wrong')
      setPasskeyStep('error')
    }
  }

  function handlePrivyLogin() {
    if (authenticated && embeddedAddress) {
      void serverClaim(embeddedAddress)
    } else {
      setWaiting(true)
      login()
    }
  }

  function handleExternalClaim() {
    if (!addrValid) return
    void serverClaim(externalAddr)
  }

  // ── Success ──────────────────────────────────────────────────────────────────
  if (claimStep === 'success') {
    return (
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22 }}
        className="rounded-3xl overflow-hidden"
        style={{ border: '3px solid #0F172A', boxShadow: '0 8px 0 0 #0F172A', background: 'white' }}
      >
        <div
          className="py-8 text-center flex flex-col items-center gap-3 px-6"
          style={{ background: 'linear-gradient(160deg,#1E293B,#0F172A)' }}
        >
          <motion.div
            animate={{ scale: [1, 1.2, 0.95, 1.1, 1] }}
            transition={{ duration: 0.6 }}
            style={{ fontSize: 64 }}
          >
            🎊
          </motion.div>
          <h2 className="font-display text-3xl text-white" style={{ letterSpacing: '-0.02em' }}>
            USDC Claimed!
          </h2>
          {amountUsdc && (
            <p className="font-body text-sm" style={{ color: 'rgba(255,255,255,0.75)' }}>
              {parseFloat(amountUsdc).toFixed(2)} USDC sent safely to your wallet
            </p>
          )}
        </div>
        <div className="p-5">
          <TxStatusBadge step="success" txHash={txHash ?? undefined} />
        </div>
      </motion.div>
    )
  }

  // ── Passkey success ───────────────────────────────────────────────────────────
  if (passkeyStep === 'success' && stellarWallet) {
    return (
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22 }}
        className="rounded-3xl overflow-hidden"
        style={{ border: '3px solid #0F172A', boxShadow: '0 8px 0 0 #0F172A', background: 'white' }}
      >
        <div
          className="py-8 text-center flex flex-col items-center gap-3 px-6"
          style={{ background: 'linear-gradient(160deg,#1E293B,#0F172A)' }}
        >
          <motion.div
            animate={{ rotate: [0, -10, 10, -6, 6, 0] }}
            transition={{ duration: 0.7, delay: 0.2 }}
            style={{ fontSize: 64 }}
          >
            ✨
          </motion.div>
          <h2 className="font-display text-3xl text-white" style={{ letterSpacing: '-0.02em' }}>
            Claimed on Stellar!
          </h2>
          <p className="font-body text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
            {amountUsdc ? `${parseFloat(amountUsdc).toFixed(2)} USDC` : 'USDC'} sent to your passkey wallet
          </p>
        </div>
        <div className="p-5 flex flex-col gap-3">
          {/* Wallet address */}
          <div className="rounded-2xl px-4 py-3" style={{ background: '#F8FAFC', border: '1.5px solid #E2E8F0' }}>
            <p className="font-body text-xs uppercase tracking-wider mb-1" style={{ color: '#94A3B8' }}>
              Your Stellar Wallet
            </p>
            <p className="font-mono text-xs break-all" style={{ color: '#1E293B' }}>
              {stellarWallet}
            </p>
          </div>
          {/* Explorer link */}
          {stellarTxHash && (
            <a
              href={`https://stellar.expert/explorer/testnet/tx/${stellarTxHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-body text-sm text-center py-2 rounded-xl block"
              style={{ color: '#0EA5E9', background: '#F0F9FF', border: '1px solid #BAE6FD' }}
            >
              View on Stellar Expert ↗
            </a>
          )}
          <p className="font-body text-xs text-center" style={{ color: '#94A3B8' }}>
            Your wallet is secured by your device biometric — no seed phrase ever created
          </p>
        </div>
      </motion.div>
    )
  }

  // ── Passkey in-progress spinner ───────────────────────────────────────────────
  if (passkeyStep !== 'idle' && passkeyStep !== 'error' && passkeyStep !== 'success') {
    const STEP_LABELS: Record<string, string> = {
      registering: 'Registering your biometric…',
      deploying:   'Authenticating passkey…',
      claiming:    'Preparing claim…',
      bridging:    'Sending USDC to Stellar…',
    }
    const STEP_ICONS: Record<string, string> = {
      registering: '👆',
      deploying:   '🔑',
      claiming:    '⛓️',
      bridging:    '🌉',
    }
    const steps = ['registering', 'deploying', 'claiming', 'bridging'] as const
    const currentIdx = steps.indexOf(passkeyStep)

    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl overflow-hidden"
        style={{ border: '3px solid #0F172A', boxShadow: '0 8px 0 0 #0F172A', background: 'white' }}
      >
        <div
          className="px-6 py-8 flex flex-col items-center gap-4 text-center"
          style={{ background: 'linear-gradient(160deg,#1E293B,#0F172A)' }}
        >
          <motion.div
            animate={{ scale: [1, 1.15, 1], opacity: [1, 0.7, 1] }}
            transition={{ duration: 1.4, repeat: Infinity }}
            style={{ fontSize: 56 }}
          >
            {STEP_ICONS[passkeyStep] ?? '⏳'}
          </motion.div>
          <h3 className="font-display text-2xl text-white">{STEP_LABELS[passkeyStep]}</h3>
          {/* Step dots */}
          <div className="flex gap-2 mt-1">
            {steps.map((s, i) => (
              <motion.div
                key={s}
                className="h-2 rounded-full"
                style={{
                  width: i === currentIdx ? 24 : 8,
                  background: i <= currentIdx ? '#38BDF8' : 'rgba(255,255,255,0.2)',
                }}
                animate={{ width: i === currentIdx ? 24 : 8 }}
                transition={{ duration: 0.3 }}
              />
            ))}
          </div>
        </div>
      </motion.div>
    )
  }

  // ── Wallet-wait spinner ───────────────────────────────────────────────────────
  if (waitingForWallet && !embeddedAddress && claimStep === 'idle') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl overflow-hidden"
        style={{ border: '3px solid #0F172A', boxShadow: '0 8px 0 0 #0F172A', background: 'white' }}
      >
        <div
          className="px-6 py-8 flex flex-col items-center gap-4 text-center"
          style={{ background: 'linear-gradient(160deg,#1E293B,#0F172A)' }}
        >
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          >
            <MascotSVG size={72} animate={false} expression="happy" festive />
          </motion.div>
          <h3 className="font-display text-2xl text-white">Setting up your wallet…</h3>
          <p className="font-body text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
            This takes a few seconds for new accounts
          </p>
          <div className="flex gap-1.5 mt-1">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-2.5 h-2.5 rounded-full"
                style={{ background: '#38BDF8' }}
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
              />
            ))}
          </div>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 200, damping: 24 }}
      className="rounded-3xl overflow-hidden"
      style={{ border: '3px solid #0F172A', boxShadow: '0 8px 0 0 #0F172A', background: 'white' }}
    >
      {/* Header */}
      <div className="py-5 px-6" style={{ background: 'linear-gradient(160deg,#1E293B,#0F172A)' }}>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl text-white" style={{ letterSpacing: '-0.02em' }}>
            Claim Your USDC
          </h2>
          <span className="text-[10px] font-mono uppercase bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30">
            EIP-712 Protected
          </span>
        </div>
        {amountUsdc && (
          <p className="font-body font-800 mt-1" style={{ color: '#38BDF8', fontSize: 20 }}>
            {parseFloat(amountUsdc).toFixed(2)} USDC ready for you
          </p>
        )}
      </div>

      <div className="p-5 flex flex-col gap-4">
        <AnimatePresence mode="wait">
          {/* ── Mode: choose ─────────────────────────────────────────────── */}
          {mode === 'choose' && (
            <motion.div
              key="choose"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="flex flex-col gap-3"
            >
              {/* Primary: Google / Email → auto-created wallet */}
              <motion.button
                onClick={handlePrivyLogin}
                disabled={isPending}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98, y: 1 }}
                className="btn-press w-full font-display text-xl py-4 rounded-2xl text-white flex items-center justify-center gap-2"
                style={{
                  background: isPending
                    ? 'linear-gradient(135deg,#475569,#334155)'
                    : 'linear-gradient(135deg,#38BDF8,#0EA5E9)',
                  boxShadow: '0 6px 0 0 #0284C7',
                }}
              >
                {claimStep === 'signing'
                  ? '🔐 Signing claim…'
                  : claimStep === 'sending' || claimStep === 'confirming'
                  ? '⏳ Claiming on Arc…'
                  : authenticated && embeddedAddress
                  ? '✨ Claim to My Wallet'
                  : '✨ Sign in & Claim'}
              </motion.button>

              <p className="font-body text-xs text-center" style={{ color: '#94A3B8' }}>
                {authenticated && embeddedAddress
                  ? `Claiming to ${embeddedAddress.slice(0, 6)}…${embeddedAddress.slice(-4)}`
                  : 'Sign in with Google or email — we set up your wallet in seconds'}
              </p>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px" style={{ background: '#E2E8F0' }} />
                <span className="font-body text-xs font-700" style={{ color: '#CBD5E1' }}>
                  OR
                </span>
                <div className="flex-1 h-px" style={{ background: '#E2E8F0' }} />
              </div>

              {/* Secondary: send to an external address */}
              <motion.button
                onClick={() => setMode('external')}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="btn-press w-full font-display text-lg py-3.5 rounded-2xl"
                style={{
                  background: '#F8FAFC',
                  border: '2.5px solid #1E293B',
                  boxShadow: '0 4px 0 0 #0F172A',
                  color: '#1E293B',
                }}
              >
                Send to a specific address →
              </motion.button>

              <p className="font-body text-xs text-center" style={{ color: '#94A3B8' }}>
                Paste any Arc-compatible wallet address (MetaMask, Coinbase, Safe)
              </p>

              {/* Passkey path — only shown if device supports WebAuthn */}
              {passkeySupported && (
                <>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px" style={{ background: '#E2E8F0' }} />
                    <span className="font-body text-xs font-700" style={{ color: '#CBD5E1' }}>
                      OR
                    </span>
                    <div className="flex-1 h-px" style={{ background: '#E2E8F0' }} />
                  </div>

                  <motion.button
                    onClick={() => void handlePasskeyClaim()}
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98, y: 1 }}
                    className="btn-press w-full font-display text-lg py-4 rounded-2xl flex items-center justify-center gap-3"
                    style={{
                      background: 'linear-gradient(135deg,#0F172A,#1E293B)',
                      color: 'white',
                      boxShadow: '0 6px 0 0 #020617',
                    }}
                  >
                    <span style={{ fontSize: 22 }}>👆</span>
                    <span>
                      {hasCachedWallet ? 'Claim with Passkey (Stellar)' : 'Claim with Face ID / Fingerprint'}
                    </span>
                  </motion.button>

                  <p className="font-body text-xs text-center" style={{ color: '#94A3B8' }}>
                    {hasCachedWallet
                      ? `Stellar wallet: ${stellarWallet!.slice(0, 8)}…${stellarWallet!.slice(-6)}`
                      : 'No account needed — your biometric IS your wallet on Stellar'}
                  </p>

                  {passkeyStep === 'error' && passkeyError && (
                    <p className="font-body text-xs text-center px-2 py-2 rounded-xl"
                      style={{ color: '#DC2626', background: '#FEF2F2', border: '1px solid #FECACA' }}>
                      {passkeyError}
                    </p>
                  )}
                </>
              )}
            </motion.div>
          )}

          {/* ── Mode: external address ────────────────────────────────────── */}
          {mode === 'external' && (
            <motion.div
              key="external"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="flex flex-col gap-4"
            >
              <button
                onClick={() => {
                  setMode('choose')
                  resetClaim()
                }}
                className="font-body text-sm font-700 self-start"
                style={{ color: '#94A3B8' }}
              >
                ← Back
              </button>

              <div>
                <label
                  className="font-body text-xs font-800 block mb-1.5 uppercase tracking-wider"
                  style={{ color: '#64748B' }}
                >
                  Destination wallet address
                </label>
                <input
                  type="text"
                  value={externalAddr}
                  onChange={(e) => setExternalAddr(e.target.value.trim())}
                  placeholder="0x…"
                  className="w-full rounded-2xl px-4 py-3 font-body text-sm outline-none"
                  style={{
                    border: `2.5px solid ${
                      externalAddr && !addrValid ? '#F87171' : addrValid ? '#38BDF8' : '#E2E8F0'
                    }`,
                    background: '#F8FAFC',
                    color: '#1E293B',
                  }}
                />
                {externalAddr && !addrValid && (
                  <p className="font-body text-xs mt-1" style={{ color: '#F87171' }}>
                    Invalid address
                  </p>
                )}
              </div>

              {!authenticated ? (
                <motion.button
                  onClick={() => {
                    setWaiting(true)
                    login()
                  }}
                  disabled={!addrValid}
                  whileHover={{ scale: 1.03, y: -1 }}
                  whileTap={{ scale: 0.97, y: 1 }}
                  className="btn-press w-full font-display text-xl py-4 rounded-2xl text-white"
                  style={{
                    background: !addrValid
                      ? 'linear-gradient(135deg,#475569,#334155)'
                      : 'linear-gradient(135deg,#38BDF8,#0EA5E9)',
                    boxShadow: '0 6px 0 0 #0284C7',
                  }}
                >
                  Sign in to submit claim →
                </motion.button>
              ) : (
                <motion.button
                  onClick={handleExternalClaim}
                  disabled={!addrValid || isPending}
                  whileHover={{ scale: 1.03, y: -1 }}
                  whileTap={{ scale: 0.97, y: 1 }}
                  className="btn-press w-full font-display text-xl py-4 rounded-2xl text-white"
                  style={{
                    background:
                      !addrValid || isPending
                        ? 'linear-gradient(135deg,#475569,#334155)'
                        : 'linear-gradient(135deg,#38BDF8,#0EA5E9)',
                    boxShadow: '0 6px 0 0 #0284C7',
                  }}
                >
                  {claimStep === 'signing'
                    ? '🔐 Signing claim…'
                    : isPending
                    ? '⏳ Claiming USDC…'
                    : 'Claim USDC →'}
                </motion.button>
              )}

              <TxStatusBadge step={claimStep} errorMsg={errorMsg ?? undefined} txHash={txHash ?? undefined} />

              <p className="font-body text-xs text-center" style={{ color: '#94A3B8' }}>
                Protected by EIP-712 — MEV bots cannot front-run or divert your funds
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Status badge for Privy login path */}
        {mode === 'choose' && claimStep !== 'idle' && (
          <TxStatusBadge step={claimStep} errorMsg={errorMsg ?? undefined} txHash={txHash ?? undefined} />
        )}
      </div>
    </motion.div>
  )
}
