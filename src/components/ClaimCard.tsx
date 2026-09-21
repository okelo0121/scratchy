/**
 * ClaimCard — smart claim flow with wallet-wait spinner.
 *
 * Paths:
 *   A) "Claim via Google / Email" → Privy login → wait for embedded wallet → auto-claim
 *   B) "I have an external wallet" → paste any 0x address → claim to that address
 */
import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePrivy, useWallets } from '@privy-io/react-auth'
import { isAddress } from 'viem'
import { useClaimGift } from '@/hooks/useGiftContract'
import MascotSVG from './MascotSVG'
import TxStatusBadge from './TxStatusBadge'

interface Props {
  secretKey: Uint8Array
  amountUsdc: string | null
  onSuccess: () => void
}

export default function ClaimCard({ secretKey, amountUsdc, onSuccess }: Props) {
  const { authenticated, login } = usePrivy()
  const { wallets } = useWallets()
  const embeddedWallet  = wallets.find((w) => w.walletClientType === 'privy')
  const embeddedAddress = embeddedWallet?.address as `0x${string}` | undefined

  const [mode, setMode]                   = useState<'choose' | 'external'>('choose')
  const [externalAddr, setExternalAddr]   = useState('')
  const [waitingForWallet, setWaiting]    = useState(false)
  const autoClaimedRef                    = useRef(false)
  const addrValid = isAddress(externalAddr)

  const { claimGift, step: claimStep, errorMsg, txHash, reset } = useClaimGift(onSuccess)

  // After login, wait for embedded wallet to materialise then auto-claim
  useEffect(() => {
    if (!waitingForWallet || autoClaimedRef.current) return
    if (!embeddedAddress) return
    autoClaimedRef.current = true
    void claimGift(secretKey, embeddedAddress)
  }, [waitingForWallet, embeddedAddress, claimGift, secretKey])

  async function handlePrivyLogin() {
    if (authenticated && embeddedAddress) {
      // Already logged in with wallet — claim immediately
      await claimGift(secretKey, embeddedAddress)
    } else {
      setWaiting(true)
      login()
      // After login() triggers, the useEffect above fires once embeddedWallet appears
    }
  }

  async function claimToExternal() {
    if (!addrValid) return
    await claimGift(secretKey, externalAddr)
  }

  const isPending = claimStep === 'sending' || claimStep === 'confirming'

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
            <p className="font-body text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>
              {parseFloat(amountUsdc).toFixed(2)} USDC sent to your wallet
            </p>
          )}
        </div>
        <div className="p-5">
          <TxStatusBadge step="success" txHash={txHash} />
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
          <motion.div
            className="flex gap-1.5 mt-1"
          >
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-2.5 h-2.5 rounded-full"
                style={{ background: '#38BDF8' }}
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
              />
            ))}
          </motion.div>
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
        <h2 className="font-display text-2xl text-white" style={{ letterSpacing: '-0.02em' }}>
          Claim Your USDC
        </h2>
        {amountUsdc && (
          <p className="font-body font-800 mt-1" style={{ color: '#38BDF8', fontSize: 20 }}>
            {parseFloat(amountUsdc).toFixed(2)} USDC ready for you
          </p>
        )}
      </div>

      <div className="p-5 flex flex-col gap-4">
        <AnimatePresence mode="wait">
          {mode === 'choose' && (
            <motion.div
              key="choose"
              initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
              className="flex flex-col gap-3"
            >
              {/* Primary: Google / Email */}
              <motion.button
                onClick={() => void handlePrivyLogin()}
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
                {isPending
                  ? '⏳ Claiming…'
                  : authenticated && embeddedAddress
                    ? '✨ Claim to My Wallet'
                    : '✨ Claim via Google / Email'}
              </motion.button>

              <p className="font-body text-xs text-center" style={{ color: '#94A3B8' }}>
                {authenticated && embeddedAddress
                  ? `Sending to ${embeddedAddress.slice(0, 6)}…${embeddedAddress.slice(-4)}`
                  : 'Sign in and we create a wallet for you — no crypto knowledge needed'}
              </p>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px" style={{ background: '#E2E8F0' }} />
                <span className="font-body text-xs font-700" style={{ color: '#CBD5E1' }}>OR</span>
                <div className="flex-1 h-px" style={{ background: '#E2E8F0' }} />
              </div>

              {/* Secondary: External wallet */}
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
                I have an external wallet →
              </motion.button>
            </motion.div>
          )}

          {mode === 'external' && (
            <motion.div
              key="external"
              initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
              className="flex flex-col gap-4"
            >
              <button
                onClick={() => { setMode('choose'); reset() }}
                className="font-body text-sm font-700 self-start"
                style={{ color: '#94A3B8' }}
              >
                ← Back
              </button>

              <div>
                <label className="font-body text-xs font-800 block mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>
                  Your wallet address
                </label>
                <input
                  type="text"
                  value={externalAddr}
                  onChange={(e) => setExternalAddr(e.target.value.trim())}
                  placeholder="0x…"
                  className="w-full rounded-2xl px-4 py-3 font-body text-sm outline-none"
                  style={{
                    border: `2.5px solid ${externalAddr && !addrValid ? '#F87171' : addrValid ? '#38BDF8' : '#E2E8F0'}`,
                    background: '#F8FAFC',
                    color: '#1E293B',
                  }}
                />
                {externalAddr && !addrValid && (
                  <p className="font-body text-xs mt-1" style={{ color: '#F87171' }}>Invalid Ethereum address</p>
                )}
              </div>

              <motion.button
                onClick={() => void claimToExternal()}
                disabled={!addrValid || isPending}
                whileHover={{ scale: 1.03, y: -1 }}
                whileTap={{ scale: 0.97, y: 1 }}
                className="btn-press w-full font-display text-xl py-4 rounded-2xl text-white"
                style={{
                  background: !addrValid || isPending
                    ? 'linear-gradient(135deg,#475569,#334155)'
                    : 'linear-gradient(135deg,#38BDF8,#0EA5E9)',
                  boxShadow: '0 6px 0 0 #0284C7',
                }}
              >
                {isPending ? '⏳ Claiming…' : 'Claim USDC →'}
              </motion.button>

              <TxStatusBadge step={claimStep} errorMsg={errorMsg} txHash={txHash} />

              <p className="font-body text-xs text-center" style={{ color: '#94A3B8' }}>
                USDC transfers instantly on Arc — sub-second finality
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Show status badge for privy path too */}
        {mode === 'choose' && (claimStep !== 'idle') && (
          <TxStatusBadge step={claimStep} errorMsg={errorMsg} txHash={txHash} />
        )}
      </div>
    </motion.div>
  )
}
