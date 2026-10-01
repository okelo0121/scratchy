/**
 * StellarWallet — full mobile-app-style Stellar USDC wallet
 * Controlled by passkey (biometric). Three tabs: Balance, Send, Withdraw.
 * Can be rendered inline after claim, as a standalone /wallet page, or in the dashboard.
 */
import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStellarBalance } from '@/hooks/useStellarBalance'
import { useStellarSend } from '@/hooks/useStellarSend'
import { reconnectPasskeyWallet, getCachedKeyId } from '@/lib/passkeyClient'

type Tab = 'balance' | 'send' | 'withdraw'

interface Props {
  /** Stellar C... smart wallet address */
  walletAddress: string
  /** USDC amount just claimed — shown on first open */
  claimedAmount?: string
  /** Called when user wants to close/dismiss the wallet (optional) */
  onClose?: () => void
}

export default function StellarWallet({ walletAddress, claimedAmount, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('balance')
  const [copied, setCopied] = useState(false)
  const { usdc: balance, loading: balLoading, refresh } = useStellarBalance(walletAddress)

  // Animate balance number counting up on mount
  const [displayBal, setDisplayBal] = useState(0)
  const animRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null)
  useEffect(() => {
    if (!balance) return
    const target = parseFloat(balance)
    if (isNaN(target)) return
    const duration = 1000
    const start = performance.now()
    function step(now: number) {
      const t = Math.min((now - start) / duration, 1)
      const ease = 1 - Math.pow(1 - t, 3)
      setDisplayBal(parseFloat((target * ease).toFixed(6)))
      if (t < 1) animRef.current = requestAnimationFrame(step)
    }
    animRef.current = requestAnimationFrame(step)
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current) }
  }, [balance])

  function copyAddress() {
    void navigator.clipboard.writeText(walletAddress).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const shortAddr = `${walletAddress.slice(0, 8)}…${walletAddress.slice(-6)}`
  const explorerUrl = `https://stellar.expert/explorer/testnet/account/${walletAddress}`
  const lobstrUrl = `https://lobstr.co/`

  // QR code data URL — encode via API
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  useEffect(() => {
    import('qrcode').then((QRCode) => {
      QRCode.default.toDataURL(walletAddress, {
        width: 200,
        margin: 2,
        color: { dark: '#0F172A', light: '#FFFFFF' },
      }).then(setQrDataUrl).catch(() => null)
    }).catch(() => null)
  }, [walletAddress])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 240, damping: 24 }}
      className="rounded-3xl overflow-hidden w-full"
      style={{
        background: '#0F172A',
        border: '3px solid #1E293B',
        boxShadow: '0 12px 0 0 rgba(0,0,0,0.25), 0 0 0 1px rgba(56,189,248,0.1)',
        maxWidth: 480,
        margin: '0 auto',
      }}
    >
      {/* ── Header ── */}
      <div
        className="px-6 pt-6 pb-4 relative"
        style={{ background: 'linear-gradient(160deg,#0F172A 0%,#1E293B 100%)' }}
      >
        {/* Close button */}
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}
          >
            ✕
          </button>
        )}

        {/* Stellar badge */}
        <div className="flex items-center gap-2 mb-4">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
            style={{ background: 'linear-gradient(135deg,#38BDF8,#0EA5E9)', color: 'white' }}
          >
            ✦
          </div>
          <span className="font-body text-xs font-800 uppercase tracking-widest" style={{ color: '#38BDF8' }}>
            Stellar Passkey Wallet
          </span>
          <span className="font-body text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(56,189,248,0.12)', color: '#7DD3FC' }}>
            TESTNET
          </span>
        </div>

        {/* Balance */}
        <div className="mb-1">
          <p className="font-body text-xs font-800 uppercase tracking-widest mb-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
            USDC Balance
          </p>
          {balLoading && balance === null ? (
            <div className="h-12 w-32 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.06)' }} />
          ) : (
            <motion.p
              className="font-display text-5xl text-white"
              style={{ letterSpacing: '-0.03em', lineHeight: 1 }}
            >
              {displayBal.toFixed(2)}
              <span className="text-2xl ml-2 font-body font-800" style={{ color: '#38BDF8' }}>USDC</span>
            </motion.p>
          )}
        </div>

        {/* If just claimed, show a "just received" banner */}
        {claimedAmount && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 }}
            className="mt-3 rounded-2xl px-3 py-2 flex items-center gap-2"
            style={{ background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.2)' }}
          >
            <span style={{ fontSize: 16 }}>🎊</span>
            <p className="font-body text-sm font-700" style={{ color: '#7DD3FC' }}>
              {parseFloat(claimedAmount).toFixed(2)} USDC just arrived in your wallet
            </p>
          </motion.div>
        )}

        {/* Address pill */}
        <button
          onClick={copyAddress}
          className="mt-3 flex items-center gap-2 rounded-2xl px-3 py-2 w-full text-left"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <span className="font-mono text-xs flex-1" style={{ color: 'rgba(255,255,255,0.45)' }}>
            {shortAddr}
          </span>
          <span className="font-body text-xs font-800" style={{ color: copied ? '#4ADE80' : '#38BDF8' }}>
            {copied ? '✓ Copied' : 'Copy'}
          </span>
        </button>

        {/* Refresh */}
        <button
          onClick={refresh}
          className="absolute bottom-4 right-6 font-body text-[10px] font-800"
          style={{ color: 'rgba(255,255,255,0.2)' }}
        >
          ↻ Refresh
        </button>
      </div>

      {/* ── Tab bar ── */}
      <div
        className="flex gap-1 px-4 pt-3 pb-0"
        style={{ background: '#0F172A', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        {(['balance', 'send', 'withdraw'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex-1 pb-3 font-body text-sm font-800 capitalize relative"
            style={{ color: tab === t ? '#38BDF8' : 'rgba(255,255,255,0.3)' }}
          >
            {t === 'balance' ? '📊 Balance' : t === 'send' ? '📤 Send' : '🏦 Withdraw'}
            {tab === t && (
              <motion.div
                layoutId="tab-indicator"
                className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                style={{ background: '#38BDF8' }}
              />
            )}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      <AnimatePresence mode="wait">
        {tab === 'balance' && (
          <BalanceTab
            key="balance"
            walletAddress={walletAddress}
            explorerUrl={explorerUrl}
            qrDataUrl={qrDataUrl}
          />
        )}
        {tab === 'send' && (
          <SendTab
            key="send"
            walletAddress={walletAddress}
            balance={balance ?? '0'}
            onSent={refresh}
          />
        )}
        {tab === 'withdraw' && (
          <WithdrawTab
            key="withdraw"
            walletAddress={walletAddress}
            explorerUrl={explorerUrl}
            lobstrUrl={lobstrUrl}
            qrDataUrl={qrDataUrl}
          />
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ── Balance Tab ───────────────────────────────────────────────────────────────

function BalanceTab({ walletAddress, explorerUrl, qrDataUrl }: {
  walletAddress: string
  explorerUrl: string
  qrDataUrl: string | null
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      transition={{ duration: 0.18 }}
      className="px-5 py-5 flex flex-col gap-4"
    >
      {/* QR code */}
      {qrDataUrl && (
        <div className="flex flex-col items-center gap-2">
          <div
            className="rounded-2xl p-3"
            style={{ background: 'white', border: '2px solid rgba(255,255,255,0.1)' }}
          >
            <img src={qrDataUrl} alt="Wallet QR" width={160} height={160} className="rounded-xl" />
          </div>
          <p className="font-body text-xs text-center" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Scan to send USDC to this wallet
          </p>
        </div>
      )}

      {/* Full address */}
      <div
        className="rounded-2xl px-4 py-3"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <p className="font-body text-[10px] uppercase tracking-widest font-800 mb-1" style={{ color: 'rgba(255,255,255,0.25)' }}>
          Full Wallet Address
        </p>
        <p className="font-mono text-xs break-all leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>
          {walletAddress}
        </p>
      </div>

      {/* Explorer link */}
      <a
        href={explorerUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="w-full py-3 rounded-2xl font-body text-sm font-800 text-center flex items-center justify-center gap-2"
        style={{
          background: 'rgba(56,189,248,0.1)',
          border: '1px solid rgba(56,189,248,0.2)',
          color: '#38BDF8',
        }}
      >
        View on Stellar Expert ↗
      </a>

      {/* Biometric note */}
      <p className="font-body text-xs text-center" style={{ color: 'rgba(255,255,255,0.2)' }}>
        Secured by your device biometric — no seed phrase ever created
      </p>
    </motion.div>
  )
}

// ── Send Tab ──────────────────────────────────────────────────────────────────

function SendTab({ walletAddress, balance, onSent }: {
  walletAddress: string
  balance: string
  onSent: () => void
}) {
  const [recipient, setRecipient] = useState('')
  const [amount, setAmount] = useState('')
  const { send, step, error: errorMsg, txHash, reset } = useStellarSend()

  const maxBal = balance ? Math.max(0, parseFloat(balance) - 0.01) : 0
  const amountNum = parseFloat(amount)
  const recipientValid = recipient.length > 0 && (recipient.startsWith('G') || recipient.startsWith('C')) && recipient.length >= 50
  const amountValid = !isNaN(amountNum) && amountNum > 0 && amountNum <= maxBal
  const canSend = recipientValid && amountValid && step === 'idle'

  async function handleSend() {
    if (!canSend) return
    // Reconnect passkey for signing
    const keyId = getCachedKeyId()
    if (!keyId) {
      // Re-authenticate
      await reconnectPasskeyWallet()
    }
    await send({ from: walletAddress, to: recipient, amount })
    onSent()
  }

  if (step === 'success' && txHash) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="px-5 py-6 flex flex-col items-center gap-4 text-center"
      >
        <motion.div
          animate={{ scale: [1, 1.3, 0.9, 1.1, 1] }}
          transition={{ duration: 0.7 }}
          style={{ fontSize: 56 }}
        >
          ✅
        </motion.div>
        <p className="font-display text-2xl text-white">Sent!</p>
        <p className="font-body text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
          {amountNum.toFixed(2)} USDC sent to {recipient.slice(0, 8)}…
        </p>
        <a
          href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-body text-sm"
          style={{ color: '#38BDF8' }}
        >
          View transaction ↗
        </a>
        <button
          onClick={reset}
          className="font-body text-sm font-800 mt-2"
          style={{ color: 'rgba(255,255,255,0.4)' }}
        >
          Send another
        </button>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      transition={{ duration: 0.18 }}
      className="px-5 py-5 flex flex-col gap-4"
    >
      {/* Recipient */}
      <div>
        <label className="font-body text-xs font-800 uppercase tracking-widest block mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
          Recipient Address
        </label>
        <input
          type="text"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value.trim())}
          placeholder="G... or C... Stellar address"
          className="w-full rounded-2xl px-4 py-3 font-mono text-sm outline-none"
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: `1.5px solid ${recipient && !recipientValid ? '#F87171' : recipient && recipientValid ? '#38BDF8' : 'rgba(255,255,255,0.1)'}`,
            color: 'white',
          }}
        />
        {recipient && !recipientValid && (
          <p className="font-body text-xs mt-1" style={{ color: '#F87171' }}>
            Must be a Stellar G... or C... address (56 chars)
          </p>
        )}
      </div>

      {/* Amount */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="font-body text-xs font-800 uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Amount (USDC)
          </label>
          {balance && (
            <span className="font-body text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Available: {parseFloat(balance).toFixed(2)} USDC
            </span>
          )}
        </div>
        <div className="relative">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            min="0"
            step="0.01"
            className="w-full rounded-2xl px-4 py-3 font-body text-sm outline-none pr-16"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: `1.5px solid ${amount && !amountValid ? '#F87171' : amount && amountValid ? '#38BDF8' : 'rgba(255,255,255,0.1)'}`,
              color: 'white',
            }}
          />
          <button
            onClick={() => setAmount(maxBal.toFixed(6))}
            className="absolute right-3 top-1/2 -translate-y-1/2 font-body text-xs font-800 px-2 py-1 rounded-lg"
            style={{ background: 'rgba(56,189,248,0.15)', color: '#38BDF8' }}
          >
            MAX
          </button>
        </div>

        {/* Quick amounts */}
        <div className="flex gap-2 mt-2">
          {['1', '5', '10', '25'].map((v) => (
            <button
              key={v}
              onClick={() => setAmount(v)}
              className="flex-1 py-1.5 rounded-xl font-body text-xs font-800"
              style={{
                background: amount === v ? '#38BDF8' : 'rgba(255,255,255,0.05)',
                color: amount === v ? '#0F172A' : 'rgba(255,255,255,0.4)',
                border: `1px solid ${amount === v ? '#38BDF8' : 'rgba(255,255,255,0.08)'}`,
              }}
            >
              ${v}
            </button>
          ))}
        </div>
      </div>

      {/* Send button */}
      <motion.button
        onClick={() => void handleSend()}
        disabled={!canSend || step !== 'idle'}
        whileHover={canSend ? { scale: 1.02, y: -2 } : {}}
        whileTap={canSend ? { scale: 0.98 } : {}}
        className="w-full py-4 rounded-2xl font-display text-lg text-white"
        style={{
          background: !canSend || step !== 'idle'
            ? 'rgba(255,255,255,0.08)'
            : 'linear-gradient(135deg,#38BDF8,#0EA5E9)',
          boxShadow: canSend && step === 'idle' ? '0 6px 0 0 #0284C7' : 'none',
          color: !canSend ? 'rgba(255,255,255,0.3)' : 'white',
        }}
      >
        {step === 'building' ? '🔑 Building transaction…'
          : step === 'signing' ? '👆 Confirm with biometric…'
          : step === 'submitting' ? '⏳ Submitting…'
          : '📤 Send USDC'}
      </motion.button>

      {errorMsg && (
        <p className="font-body text-xs text-center px-3 py-2 rounded-xl" style={{ color: '#F87171', background: 'rgba(248,113,113,0.08)' }}>
          {errorMsg}
        </p>
      )}

      <p className="font-body text-xs text-center" style={{ color: 'rgba(255,255,255,0.2)' }}>
        Signed by your biometric — no private key exposure
      </p>
    </motion.div>
  )
}

// ── Withdraw Tab ──────────────────────────────────────────────────────────────

function WithdrawTab({ walletAddress, explorerUrl, lobstrUrl, qrDataUrl }: {
  walletAddress: string
  explorerUrl: string
  lobstrUrl: string
  qrDataUrl: string | null
}) {
  const [copied, setCopied] = useState(false)

  function copyAddress() {
    void navigator.clipboard.writeText(walletAddress).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      transition={{ duration: 0.18 }}
      className="px-5 py-5 flex flex-col gap-3"
    >
      <p className="font-body text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
        To access your USDC in another app, use your Stellar wallet address:
      </p>

      {/* Option 1 — Lobstr */}
      <div
        className="rounded-2xl p-4 flex flex-col gap-3"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg flex-shrink-0"
            style={{ background: 'linear-gradient(135deg,#1a1a2e,#16213e)' }}
          >
            🌟
          </div>
          <div>
            <p className="font-body text-sm font-800 text-white">Lobstr Wallet</p>
            <p className="font-body text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Most popular Stellar wallet — iOS &amp; Android, free
            </p>
          </div>
        </div>
        {qrDataUrl && (
          <div className="flex items-center gap-4">
            <div className="rounded-xl p-2" style={{ background: 'white' }}>
              <img src={qrDataUrl} alt="Wallet QR" width={80} height={80} />
            </div>
            <div className="flex flex-col gap-2 flex-1">
              <p className="font-body text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                1. Download Lobstr{'\n'}
                2. Import account → paste address
              </p>
              <a
                href={lobstrUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="py-2 rounded-xl font-body text-xs font-800 text-center"
                style={{ background: 'linear-gradient(135deg,#38BDF8,#0EA5E9)', color: '#0F172A' }}
              >
                Open Lobstr ↗
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Option 2 — Stellar Expert */}
      <a
        href={explorerUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-2xl p-4 flex items-center gap-3"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div
          className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg flex-shrink-0"
          style={{ background: 'rgba(56,189,248,0.12)' }}
        >
          🔍
        </div>
        <div className="flex-1">
          <p className="font-body text-sm font-800 text-white">Stellar Expert</p>
          <p className="font-body text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
            View all transactions and balance history
          </p>
        </div>
        <span style={{ color: '#38BDF8' }}>↗</span>
      </a>

      {/* Option 3 — Copy address */}
      <button
        onClick={copyAddress}
        className="rounded-2xl p-4 flex items-center gap-3 w-full text-left"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div
          className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg flex-shrink-0"
          style={{ background: 'rgba(56,189,248,0.12)' }}
        >
          {copied ? '✓' : '📋'}
        </div>
        <div className="flex-1">
          <p className="font-body text-sm font-800" style={{ color: copied ? '#4ADE80' : 'white' }}>
            {copied ? 'Copied!' : 'Copy Wallet Address'}
          </p>
          <p className="font-mono text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
            {walletAddress.slice(0, 16)}…{walletAddress.slice(-8)}
          </p>
        </div>
      </button>

      <p className="font-body text-xs text-center pt-1" style={{ color: 'rgba(255,255,255,0.2)' }}>
        Your wallet is self-custody — only your biometric can sign transactions
      </p>
    </motion.div>
  )
}
