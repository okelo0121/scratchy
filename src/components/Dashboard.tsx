/**
 * Dashboard — AskLoyal-inspired 3-column bento layout.
 * Warm off-white canvas, pure white bento cards, hairline borders, no thick outlines.
 * All wallet state, Send, Withdraw, Gift History fully preserved.
 */
import { useState, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePrivy, useWallets } from '@privy-io/react-auth'
import { useBalance, useReadContract, useWaitForTransactionReceipt } from 'wagmi'
import { formatEther, isAddress, parseEther } from 'viem'
import { arcTestnet } from 'viem/chains'
import QRCode from 'qrcode'
import MascotSVG from './MascotSVG'
import TxStatusBadge from './TxStatusBadge'
import GiftCreator from './GiftCreator'
import { CONTRACT_ADDRESS, SCRATCH_ABI, useRefundGift } from '@/hooks/useGiftContract'
import { useGiftBalance } from '@/hooks/useGiftBalance'

// ── Design tokens ─────────────────────────────────────────────────────────────
const INK    = '#111827'
const INK_2  = '#374151'
const INK_3  = '#6B7280'
const INK_4  = '#9CA3AF'
const CANVAS = '#F5F5F7'
const SURF   = '#FFFFFF'
const BORDER = 'rgba(0,0,0,0.06)'
const ACCENT = '#111827'
const BLUE   = '#1D4ED8'

/**
 * Current unix seconds, re-read on an interval. A module-level constant would
 * freeze at page load, so a gift that expires mid-session would never flip to
 * "Expired" â€” and its refund action would never unlock â€” without a reload.
 */
function useNowSec(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))
  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface SavedAddress { label: string; address: string }
interface SentGift {
  commitment: `0x${string}`; amount: string; label: string
  emoji: string; date: string; giftUrl: string
}
interface ReceivedGift { amount: string; sender: string; date: string }
type TxStep  = 'idle' | 'sending' | 'confirming' | 'success' | 'error'
type RightTab = 'receive' | 'withdraw'

// ── localStorage helpers ──────────────────────────────────────────────────────
function lsGet<T>(key: string, fb: T): T {
  try { return (JSON.parse(localStorage.getItem(key) ?? 'null') as T | null) ?? fb } catch { return fb }
}
function lsSet(key: string, val: unknown) {
  try { localStorage.setItem(key, JSON.stringify(val)) } catch { /* ignore */ }
}

// ── Balance split ─────────────────────────────────────────────────────────────
function splitBal(raw: string | null) {
  if (!raw) return { int: '—', dec: '' }
  const [i, d = '0000'] = raw.split('.')
  return { int: i, dec: d.slice(0, 4) }
}

// ── Status pill ───────────────────────────────────────────────────────────────
function StatusPill({ commitment }: { commitment: `0x${string}` }) {
  const nowSec = useNowSec()
  const { data } = useReadContract({
    address: CONTRACT_ADDRESS, abi: SCRATCH_ABI, functionName: 'getGift',
    args: [commitment], chainId: arcTestnet.id,
    query: { enabled: Boolean(commitment) },
  })
  const base = 'text-[11px] font-semibold tracking-wide px-2.5 py-0.5 rounded-full'
  if (!data) return <span className={`${base} bg-neutral-100 text-neutral-400`}>…</span>
  const [,,expiresAt, claimed] = data as [string, bigint, bigint, boolean]
  if (claimed)                    return <span className={`${base} bg-neutral-900 text-white`}>Claimed</span>
  if (Number(expiresAt) < nowSec) return <span className={`${base} bg-neutral-100 text-neutral-400`}>Expired</span>
  return <span className={`${base} bg-blue-50 text-blue-700`}>Pending</span>
}

// ── Reclaim expired gift ──────────────────────────────────────────────────────
/**
 * Sender-side recovery for a gift nobody scratched. `refundGift` returns the
 * locked USDC to the original sender, but only once the gift is past its expiry
 * and still unclaimed — before that the contract reverts, so the action stays
 * hidden rather than offering a button that cannot succeed.
 */
function RefundPanel({ commitment, onRefunded }: {
  commitment: `0x${string}`; onRefunded?: () => void
}) {
  const nowSec = useNowSec()
  const { expiresAt, claimed, exists, refetch } = useGiftBalance(commitment)
  const { refundGift, step, errorMsg, txHash, reset } = useRefundGift(() => {
    void refetch()   // flip the gift to "claimed" onchain state
    onRefunded?.()   // and refresh the wallet balance the USDC landed in
  })

  // Reset transient tx state when the panel is pointed at a different gift,
  // so a previous gift's "Confirmed!" badge does not carry over.
  useEffect(() => {
    reset()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commitment])

  // A refund flips the gift to `claimed` onchain, which would otherwise blank
  // this panel the moment it confirms — keep the receipt and its explorer link.
  if (step === 'success') {
    return <TxStatusBadge step={step} txHash={txHash} />
  }

  if (claimed || !exists) return null

  const isExpired = expiresAt !== null && Math.floor(expiresAt / 1000) < nowSec

  if (!isExpired) {
    return expiresAt === null ? null : (
      <p className="text-[11px] text-center" style={{ color: INK_4 }}>
        Refundable after {new Date(expiresAt).toLocaleDateString()} if unclaimed.
      </p>
    )
  }

  const busy = step === 'sending' || step === 'confirming'

  return (
    <div className="flex flex-col gap-2.5">
      <TxStatusBadge step={step} errorMsg={errorMsg} txHash={txHash} />
      <motion.button
        whileTap={{ scale: 0.98 }}
        disabled={busy}
        onClick={() => void refundGift(commitment)}
        className="text-xs font-semibold py-2.5 rounded-full text-white transition-opacity disabled:opacity-50"
        style={{ background: ACCENT }}>
        {busy ? 'Reclaiming…' : 'Reclaim USDC'}
      </motion.button>
      <p className="text-[11px] text-center" style={{ color: INK_4 }}>
        This gift expired unclaimed — send the USDC back to your wallet.
      </p>
    </div>
  )
}

// ── Bento card ────────────────────────────────────────────────────────────────
function Card({ children, className = '', style = {} }: {
  children: React.ReactNode; className?: string; style?: React.CSSProperties
}) {
  return (
    <div
      className={`bg-white rounded-[28px] border overflow-hidden ${className}`}
      style={{ borderColor: BORDER, boxShadow: '0 2px 20px rgba(0,0,0,0.04)', ...style }}
    >
      {children}
    </div>
  )
}

// ── Micro label ───────────────────────────────────────────────────────────────
function Micro({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-400">{children}</p>
}

// ── Input ─────────────────────────────────────────────────────────────────────
function FInput({ value, onChange, placeholder, type = 'text', valid, large }: {
  value: string; onChange: (v: string) => void
  placeholder?: string; type?: string; valid?: boolean | null; large?: boolean
}) {
  const ring = valid === false ? 'border-red-300 ring-1 ring-red-300'
    : valid === true ? 'border-blue-300 ring-1 ring-blue-300'
    : 'border-black/[0.08]'
  return (
    <input
      type={type} value={value}
      onChange={(e) => onChange(type === 'text' ? e.target.value.trim() : e.target.value)}
      placeholder={placeholder}
      className={`w-full bg-neutral-50 border rounded-xl outline-none transition-all placeholder:text-neutral-400 ${ring} ${large ? 'px-4 py-3 text-xl font-bold tabular-nums' : 'px-4 py-3 text-sm font-mono'}`}
      style={{ color: INK }}
    />
  )
}

// ── Black pill button ─────────────────────────────────────────────────────────
function PillBtn({ children, onClick, disabled, className = '' }: {
  children: React.ReactNode; onClick?: () => void
  disabled?: boolean; className?: string
}) {
  return (
    <motion.button
      onClick={onClick} disabled={disabled}
      whileHover={disabled ? {} : { scale: 1.02 }}
      whileTap={disabled ? {} : { scale: 0.97 }}
      className={`rounded-full font-bold text-sm text-white transition-opacity disabled:opacity-40 ${className}`}
      style={{ background: ACCENT }}
    >
      {children}
    </motion.button>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
type DashView = 'home' | 'create'
interface Props { onBack: () => void; onCreateGift?: () => void }

export default function Dashboard({ onBack: _onBack }: Props) {
  const { user, logout } = usePrivy()
  const { wallets } = useWallets()
  const [view, setView] = useState<DashView>('home')
  const embedded    = wallets.find((w) => w.walletClientType === 'privy') ?? wallets[0]
  const walletAddr  = embedded?.address as `0x${string}` | undefined

  const { data: balData, refetch: refetchBal } = useBalance({
    address: walletAddr, chainId: arcTestnet.id,
    query: { enabled: Boolean(walletAddr) },
  })
  const balRaw = balData ? parseFloat(formatEther(balData.value)).toFixed(4) : null
  const { int: balInt, dec: balDec } = splitBal(balRaw)

  const [qrUrl, setQrUrl]             = useState<string | null>(null)
  const [rightTab, setRightTab]       = useState<RightTab>('receive')
  const [histTab, setHistTab]         = useState<'sent' | 'received'>('sent')
  const [copied, setCopied]           = useState(false)
  const [drawer, setDrawer]           = useState(false)
  const [balHidden, setBalHidden]     = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [centreView, setCentreView]     = useState<'home' | 'activity'>('home')
  const [selectedGift, setSelectedGift] = useState<SentGift | null>(null)
  const profileRef = useRef<HTMLDivElement>(null)

  // Send
  const [sAddr, setSAddr] = useState('')
  const [sAmt, setSAmt]   = useState('')
  const [sStep, setSStep] = useState<TxStep>('idle')
  const [sHash, setSHash] = useState<`0x${string}` | undefined>()
  const [sErr, setSErr]   = useState<string | null>(null)
  const sRef = useRef(false)

  // Withdraw
  const [wAddr, setWAddr] = useState('')
  const [wLabel, setWLabel] = useState('')
  const [wAmt, setWAmt]   = useState('')
  const [wSave, setWdSave] = useState(false)
  const [wStep, setWStep] = useState<TxStep>('idle')
  const [wHash, setWHash] = useState<`0x${string}` | undefined>()
  const [wErr, setWErr]   = useState<string | null>(null)
  const wRef = useRef(false)

  const [addrBook, setAddrBook] = useState<SavedAddress[]>(() => lsGet('sas_address_book', []))
  const [sentGifts]             = useState<SentGift[]>(() => lsGet('sas_sent_gifts', []))
  const [receivedGifts]         = useState<ReceivedGift[]>(() => lsGet('sas_received_gifts', []))

  const { isSuccess: sOk } = useWaitForTransactionReceipt({ hash: sHash, chainId: arcTestnet.id, query: { enabled: Boolean(sHash) } })
  const effS: TxStep = sStep === 'confirming' && sOk ? 'success' : sStep
  useEffect(() => { if (sOk && !sRef.current) { sRef.current = true; void refetchBal() } }, [sOk, refetchBal])

  const { isSuccess: wOk } = useWaitForTransactionReceipt({ hash: wHash, chainId: arcTestnet.id, query: { enabled: Boolean(wHash) } })
  const effW: TxStep = wStep === 'confirming' && wOk ? 'success' : wStep
  useEffect(() => { if (wOk && !wRef.current) { wRef.current = true; void refetchBal() } }, [wOk, refetchBal])

  useEffect(() => {
    if (!walletAddr) return
    QRCode.toDataURL(walletAddr, { width: 200, margin: 2, color: { dark: '#111827', light: '#FFFFFF' } })
      .then(setQrUrl).catch(() => setQrUrl(null))
  }, [walletAddr])

  useEffect(() => {
    if (!profileOpen) return
    function handleClick(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [profileOpen])

  function copyAddr() {
    if (!walletAddr) return
    void navigator.clipboard.writeText(walletAddr).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }

  const sendTx = useCallback(async (to: string, amt: string): Promise<`0x${string}`> => {
    if (!embedded) throw new Error('No wallet')
    const provider = await embedded.getEthereumProvider()
    return provider.request({
      method: 'eth_sendTransaction',
      params: [{ from: walletAddr, to, value: `0x${parseEther(amt).toString(16)}`, chainId: `0x${arcTestnet.id.toString(16)}` }],
    }) as Promise<`0x${string}`>
  }, [embedded, walletAddr])

  async function handleSend() {
    if (!isAddress(sAddr) || !sAmt || parseFloat(sAmt) <= 0) return
    setSStep('sending'); setSErr(null)
    try { const h = await sendTx(sAddr, sAmt); setSHash(h); setSStep('confirming') }
    catch (e) { setSErr(e instanceof Error ? e.message.split('\n')[0] : 'Send failed'); setSStep('error') }
  }

  async function handleWd() {
    if (!isAddress(wAddr) || !wAmt || parseFloat(wAmt) <= 0) return
    if (wSave && wLabel.trim()) {
      const updated = [...addrBook.filter((a) => a.address !== wAddr), { label: wLabel.trim(), address: wAddr }]
      setAddrBook(updated); lsSet('sas_address_book', updated)
    }
    setWStep('sending'); setWErr(null)
    try { const h = await sendTx(wAddr, wAmt); setWHash(h); setWStep('confirming') }
    catch (e) { setWErr(e instanceof Error ? e.message.split('\n')[0] : 'Withdraw failed'); setWStep('error') }
  }

  function maxWd() { if (balRaw) setWAmt(Math.max(0, parseFloat(balRaw) - 0.001).toFixed(4)) }

  const displayName = user?.google?.name ?? user?.email?.address?.split('@')[0] ?? 'You'
  const shortAddr   = walletAddr ? `${walletAddr.slice(0,6)}…${walletAddr.slice(-4)}` : '—'

  // ── Inline JSX helpers (not components — avoids "created during render" lint) ──
  const withdrawPanelJsx = (
    <div className="flex flex-col gap-4">
      {addrBook.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {addrBook.map((a) => (
            <button key={a.address} onClick={() => { setWAddr(a.address); setWLabel(a.label) }}
              className="text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-all"
              style={{ background: wAddr === a.address ? ACCENT : SURF, color: wAddr === a.address ? 'white' : INK_2, borderColor: wAddr === a.address ? ACCENT : BORDER }}>
              {a.label}
            </button>
          ))}
        </div>
      )}
      <div>
        <p className="text-[11px] font-semibold mb-1" style={{ color: INK_3 }}>Destination address</p>
        <FInput value={wAddr} onChange={setWAddr} placeholder="0x…" valid={wAddr ? isAddress(wAddr) || null : null} />
        {wAddr && !isAddress(wAddr) && <p className="text-[11px] mt-1 text-red-500">Invalid address</p>}
      </div>
      <div className="flex items-center gap-2.5">
        <button onClick={() => setWdSave((v) => !v)}
          className="w-9 h-5 rounded-full relative shrink-0 transition-colors"
          style={{ background: wSave ? ACCENT : '#D1D5DB' }}>
          <motion.div animate={{ x: wSave ? 16 : 2 }} transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm" />
        </button>
        <span className="text-xs font-medium" style={{ color: INK_3 }}>Save address</span>
      </div>
      {wSave && (
        <input type="text" value={wLabel} onChange={(e) => setWLabel(e.target.value)} placeholder="Label (e.g. My MetaMask)"
          className="w-full bg-neutral-50 border rounded-xl px-3 py-2.5 text-sm outline-none"
          style={{ color: INK, borderColor: BORDER }} />
      )}
      <div>
        <div className="flex items-center justify-between mb-1">
          <p className="text-[11px] font-semibold" style={{ color: INK_3 }}>Amount (USDC)</p>
          <button onClick={maxWd} className="text-[11px] font-semibold" style={{ color: BLUE }}>Max</button>
        </div>
        <FInput value={wAmt} onChange={setWAmt} placeholder="0.00" type="number" large />
        {balRaw && <p className="text-[11px] mt-1" style={{ color: INK_4 }}>Available: {balRaw} USDC</p>}
      </div>
      {(effW === 'idle' || effW === 'error') && (
        <PillBtn onClick={() => void handleWd()}
          disabled={!isAddress(wAddr) || !wAmt || parseFloat(wAmt) <= 0}
          className="w-full py-3">
          Withdraw →
        </PillBtn>
      )}
      <TxStatusBadge step={effW} errorMsg={wErr} txHash={wHash} />
      {effW === 'success' && (
        <button onClick={() => { setWStep('idle'); setWAddr(''); setWAmt(''); setWHash(undefined); setWLabel(''); setWdSave(false); wRef.current = false }}
          className="text-[11px] font-medium underline text-center" style={{ color: INK_4 }}>
          Withdraw again
        </button>
      )}
    </div>
  )

  const receivePanelJsx = (
    <div className="flex flex-col items-center gap-4">
      {qrUrl
        ? <img src={qrUrl} alt="Wallet QR" className="rounded-2xl" style={{ width: 184, height: 184, border: `1px solid ${BORDER}` }} />
        : <div className="rounded-2xl animate-pulse bg-neutral-100" style={{ width: 184, height: 184 }} />
      }
      <p className="text-[11px] font-medium" style={{ color: INK_4 }}>Scan to receive USDC on Arc</p>
      <div className="flex items-center gap-2 w-full px-3 py-2.5 rounded-2xl"
        style={{ background: CANVAS, border: `1px solid ${BORDER}` }}>
        <span className="flex-1 truncate text-xs font-mono" style={{ color: INK_3 }}>{walletAddr ?? '—'}</span>
        <motion.button onClick={copyAddr} whileTap={{ scale: 0.9 }}
          className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all"
          style={{ background: copied ? '#DCFCE7' : SURF, color: copied ? '#15803D' : INK_2, border: `1px solid ${copied ? '#86EFAC' : BORDER}` }}>
          {copied ? '✓ Copied' : 'Copy Address'}
        </motion.button>
      </div>
    </div>
  )

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="h-dvh w-full overflow-hidden flex flex-col" style={{ background: CANVAS, fontFamily: "'Inter','SF Pro Display',system-ui,sans-serif" }}>

      {/* ── Mobile top nav ── */}
      <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-white border-b" style={{ borderColor: BORDER }}>

        {/* Left: balance */}
        <div className="flex flex-col leading-tight">
          <span className="text-[9px] font-semibold uppercase tracking-widest" style={{ color: INK_4 }}>Balance</span>
          <div className="flex items-baseline gap-0.5 mt-0.5">
            {balHidden ? (
              <span className="text-base font-bold tracking-widest" style={{ color: INK }}>••••</span>
            ) : (
              <>
                <span className="text-base font-bold tabular-nums" style={{ color: INK }}>{balInt}</span>
                <span className="text-xs font-medium" style={{ color: INK_3 }}>.{balDec}</span>
                <span className="text-[9px] font-semibold ml-0.5" style={{ color: INK_4 }}>USDC</span>
              </>
            )}
          </div>
        </div>

        {/* Centre: icon row — eye, clock/activity */}
        <div className="flex items-center gap-1.5">
          {/* Eye toggle */}
          <button onClick={() => setBalHidden(v => !v)}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
            style={{ background: '#F3F4F6', color: INK_3 }}>
            {balHidden ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            )}
          </button>
          {/* Clock / Activity */}
          <button
            onClick={() => { setCentreView(v => v === 'activity' ? 'home' : 'activity'); setSelectedGift(null) }}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
            style={{ background: centreView === 'activity' ? '#E5E7EB' : '#F3F4F6', color: INK_3 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
          </button>
          {/* Receive / Withdraw drawer */}
          <button onClick={() => setDrawer(true)}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
            style={{ background: '#F3F4F6', color: INK_3 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
              <polyline points="17 6 23 6 23 12"/>
            </svg>
          </button>
        </div>

        {/* Right: profile chip + dropdown */}
        <div className="relative" ref={profileRef}>
          <button onClick={() => setProfileOpen(v => !v)}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-2xl transition-colors"
            style={{ background: CANVAS, border: `1px solid ${BORDER}` }}>
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
              style={{ background: ACCENT }}>
              {displayName.charAt(0).toUpperCase()}
            </div>
            <span className="text-[11px] font-semibold max-w-[60px] truncate hidden xs:block" style={{ color: INK }}>{displayName}</span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round"
              style={{ color: INK_4, transform: profileOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
          <AnimatePresence>
            {profileOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.97 }}
                transition={{ duration: 0.14 }}
                className="absolute top-full right-0 mt-2 w-52 rounded-2xl overflow-hidden z-50"
                style={{ background: SURF, border: `1px solid ${BORDER}`, boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
                {/* Identity */}
                <div className="px-4 py-3 border-b" style={{ borderColor: BORDER }}>
                  <p className="text-xs font-semibold leading-tight" style={{ color: INK }}>{displayName}</p>
                  <p className="text-[10px] font-mono mt-0.5" style={{ color: INK_4 }}>{shortAddr}</p>
                </div>
                {/* Copy address */}
                <button onClick={copyAddr}
                  className="w-full flex items-center gap-3 px-4 py-3 text-xs font-medium hover:bg-neutral-50 transition-colors"
                  style={{ color: INK_2 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                  <span>{copied ? '✓ Copied!' : 'Copy address'}</span>
                </button>
                <div style={{ height: 1, background: BORDER }} />
                {/* Sign out */}
                <button onClick={() => { setProfileOpen(false); void logout() }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-xs font-semibold hover:bg-red-50 transition-colors"
                  style={{ color: '#EF4444' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                  <span>Sign out</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── 3-column bento ── */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            COL 1 — LEFT SIDEBAR (260px)
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <aside className="hidden lg:flex flex-col justify-between shrink-0 px-5 py-7 overflow-y-auto"
          style={{ width: 260, borderRight: `1px solid ${BORDER}`, background: SURF }}>

          <div className="flex flex-col gap-7">
            {/* Brand */}
            <div className="flex items-center gap-2.5">
              <MascotSVG size={36} animate={false} expression="happy" />
              <p className="text-sm font-bold tracking-tight flex-1" style={{ color: INK }}>scratch &amp; split</p>
              {/* Activity clock icon — matches AskLoyal style */}
              <button
                onClick={() => { setCentreView(v => v === 'activity' ? 'home' : 'activity'); setSelectedGift(null) }}
                title={centreView === 'activity' ? 'Back to overview' : 'Activity'}
                className="w-9 h-9 rounded-full flex items-center justify-center transition-all shrink-0"
                style={{ background: centreView === 'activity' ? '#E5E7EB' : '#F3F4F6', color: INK_3 }}>
                {/* Clock SVG */}
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </button>
            </div>

            {/* Sidebar body — always shows balance */}
            <div className="flex flex-col gap-7">
              {/* Total balance */}
              <div>
                <div className="flex items-center justify-between">
                  <Micro>Total balance</Micro>
                  <button onClick={() => setBalHidden((v) => !v)}
                    className="text-neutral-400 hover:text-neutral-600 transition-colors"
                    title={balHidden ? 'Show balance' : 'Hide balance'}>
                    {balHidden ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                </div>
                <div className="flex items-end gap-1 mt-2">
                  {balHidden ? (
                    <span className="text-4xl font-bold leading-none tracking-widest" style={{ color: INK }}>••••</span>
                  ) : (
                    <>
                      <span className="text-4xl font-bold leading-none tabular-nums" style={{ color: INK }}>{balInt}</span>
                      <span className="text-xl font-medium mb-0.5" style={{ color: INK_3 }}>.{balDec}</span>
                    </>
                  )}
                  <span className="text-sm font-semibold mb-1 ml-0.5" style={{ color: INK_4 }}>USDC</span>
                </div>
              </div>

              {/* Sub-accounts */}
              <div className="flex flex-col gap-1.5">
                {[
                  { label: 'Main Wallet',          amount: balHidden ? '••••' : (balRaw ?? '—') },
                  { label: 'Active Scratch Gifts', amount: '0.0000' },
                ].map((r) => (
                  <div key={r.label} className="flex items-center gap-3 px-3 py-2.5 rounded-2xl" style={{ background: CANVAS }}>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate" style={{ color: INK_2 }}>{r.label}</p>
                      <p className="text-xs tabular-nums font-medium" style={{ color: INK_3 }}>{r.amount} USDC</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar footer */}
          <div className="flex flex-col gap-1">
            <div className="flex flex-col gap-0.5 mb-3">
              {[
                { icon: '📄', label: 'Documentation', href: 'https://developers.circle.com' },
                { icon: '🔍', label: 'Arc Explorer',   href: 'https://explorer.arc.io' },
                { icon: '💬', label: 'Help',            href: '#' },
              ].map((l) => (
                <a key={l.label} href={l.href} target="_blank" rel="noreferrer"
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium hover:bg-neutral-50 transition-colors"
                  style={{ color: INK_3 }}>
                  <span>{l.icon}</span>{l.label}
                </a>
              ))}
            </div>

            {/* User chip + profile dropdown */}
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => setProfileOpen((v) => !v)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-2xl transition-colors hover:bg-neutral-50"
                style={{ background: CANVAS, border: `1px solid ${BORDER}` }}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold text-white"
                  style={{ background: ACCENT }}>
                  {displayName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-xs font-semibold truncate leading-tight" style={{ color: INK }}>{displayName}</p>
                  <p className="text-[10px] font-mono truncate leading-tight" style={{ color: INK_4 }}>{shortAddr}</p>
                </div>
                <span className="shrink-0 text-xs transition-transform duration-200"
                  style={{ color: INK_4, transform: profileOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</span>
              </button>

              <AnimatePresence>
                {profileOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.97 }}
                    transition={{ duration: 0.14 }}
                    className="absolute bottom-full left-0 right-0 mb-2 rounded-2xl overflow-hidden z-50"
                    style={{ background: SURF, border: `1px solid ${BORDER}`, boxShadow: '0 8px 32px rgba(0,0,0,0.1)' }}>
                    <button
                      onClick={copyAddr}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium hover:bg-neutral-50 transition-colors"
                      style={{ color: INK_2 }}>
                      <span>{copied ? '✓' : '⧉'}</span>
                      <span>{copied ? 'Copied!' : 'Copy address'}</span>
                    </button>
                    <div style={{ height: 1, background: BORDER }} />
                    <button
                      onClick={() => { setProfileOpen(false); void logout() }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold hover:bg-red-50 transition-colors"
                      style={{ color: '#EF4444' }}>
                      <span>→</span>
                      <span>Sign out</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </aside>

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            COL 2 — CENTRE STAGE (flex-1)
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <main className={`flex-1 flex flex-col p-4 lg:p-6 gap-5 min-h-0 ${view === 'create' || centreView === 'activity' ? 'overflow-y-auto' : 'overflow-hidden'}`}>
          <AnimatePresence mode="wait">
          {view === 'create' ? (
            <motion.div key="create"
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
              transition={{ type: 'spring', stiffness: 260, damping: 26 }}>
              <GiftCreator
                onBack={() => setView('home')}
                onDone={() => setView('home')}
              />
            </motion.div>
          ) : centreView === 'activity' ? (
            <motion.div key="activity"
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }} className="flex flex-col gap-0 flex-1 min-h-0">
              <Card className="flex-1 flex flex-col overflow-hidden">
                {/* Activity header */}
                <div className="flex items-center justify-between px-7 py-5 border-b" style={{ borderColor: 'rgba(0,0,0,0.05)' }}>
                  <h2 className="text-xl font-bold" style={{ color: INK }}>Activity</h2>
                  {/* Sent / Received tabs */}
                  <div className="flex rounded-xl p-0.5 text-xs font-semibold" style={{ background: CANVAS }}>
                    {(['sent','received'] as const).map((t) => (
                      <button key={t} onClick={() => setHistTab(t)}
                        className="px-4 py-1.5 rounded-[10px] transition-all capitalize"
                        style={{ background: histTab===t ? SURF : 'transparent', color: histTab===t ? INK : INK_4,
                          boxShadow: histTab===t ? '0 1px 4px rgba(0,0,0,0.08)' : 'none' }}>
                        {t === 'sent' ? 'Sent' : 'Received'}
                      </button>
                    ))}
                  </div>
                </div>
                {/* List */}
                <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-2">
                  {histTab === 'sent' && (
                    sentGifts.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center gap-3 py-16 text-center">
                        <MascotSVG size={56} animate={false} expression="thinking" />
                        <p className="text-sm font-semibold" style={{ color: INK_2 }}>No activity yet</p>
                        <p className="text-xs" style={{ color: INK_4 }}>Your sent gifts will appear here.</p>
                      </div>
                    ) : (
                      sentGifts.slice().reverse().map((g, i) => (
                        <motion.button key={g.commitment}
                          initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.04 }}
                          onClick={() => setSelectedGift(selectedGift?.commitment === g.commitment ? null : g)}
                          className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left transition-all hover:bg-neutral-50"
                          style={{ background: selectedGift?.commitment === g.commitment ? CANVAS : 'transparent' }}>
                          <span className="text-2xl shrink-0">{g.emoji}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate" style={{ color: INK }}>{g.label}</p>
                            <p className="text-[11px] font-medium tabular-nums mt-0.5" style={{ color: INK_4 }}>{g.amount} USDC · {g.date}</p>
                          </div>
                          <StatusPill commitment={g.commitment} />
                          <span className="text-neutral-300 ml-1">›</span>
                        </motion.button>
                      ))
                    )
                  )}
                  {histTab === 'received' && (
                    receivedGifts.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center gap-3 py-16 text-center">
                        <MascotSVG size={56} animate={false} expression="thinking" />
                        <p className="text-sm font-semibold" style={{ color: INK_2 }}>No activity yet</p>
                        <p className="text-xs" style={{ color: INK_4 }}>Gifts you claim will appear here.</p>
                      </div>
                    ) : (
                      receivedGifts.slice().reverse().map((g, i) => (
                        <motion.div key={i}
                          initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.04 }}
                          className="flex items-center gap-3 px-4 py-3.5 rounded-2xl" style={{ background: 'transparent' }}>
                          <span className="text-2xl shrink-0">🎊</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold" style={{ color: INK }}>Gift received</p>
                            <p className="text-[11px] font-medium mt-0.5" style={{ color: INK_4 }}>{g.amount} USDC · {g.date}</p>
                          </div>
                          <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-neutral-900 text-white shrink-0">Claimed</span>
                        </motion.div>
                      ))
                    )
                  )}
                </div>
              </Card>
            </motion.div>
          ) : (
          <motion.div key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }} className="flex flex-col gap-5 flex-1 min-h-0">

          {/* Hero card */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 220, damping: 26 }} className="flex-1 flex flex-col min-h-0">
            <Card className="relative flex-1 flex flex-col">
              {/* Dot grid */}
              <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
                style={{ backgroundImage: 'radial-gradient(circle,#000 1px,transparent 1px)', backgroundSize: '24px 24px' }} />

              <div className="relative z-10 flex flex-col justify-between p-6 lg:p-10 flex-1">
                {/* Headline */}
                <h1 className="font-black uppercase leading-[1.05] tracking-tight"
                  style={{ fontSize: 'clamp(1.6rem,4vw,3.2rem)', color: INK }}>
                  Send a mystery<br />
                  <span style={{ color: INK_3 }}>scratch gift</span><br />
                  in under a second
                </h1>

                {/* CTA + Ollie — Ollie sits above the button on mobile, beside on lg */}
                <div className="mt-6 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
                  <PillBtn onClick={() => setView('create')} className="px-6 py-3.5 text-sm lg:px-7 lg:py-4 lg:text-base w-full lg:w-auto">
                    + Create Scratch Gift
                  </PillBtn>
                  {/* Ollie peeking from bottom-right — offset only on lg where there's room */}
                  <div className="hidden lg:block self-end lg:translate-y-4 lg:translate-x-2 shrink-0 opacity-90 pointer-events-none">
                    <MascotSVG size={96} animate expression="excited" festive />
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Quick Send */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.07, type: 'spring', stiffness: 220, damping: 26 }}>
            <Card>
              <div className="p-6 flex flex-col gap-5">
                <div className="flex items-center justify-between">
                  <div><Micro>Quick Transfer</Micro>
                    <h2 className="text-lg font-bold mt-0.5" style={{ color: INK }}>Send USDC</h2>
                  </div>
                  <span className="text-2xl select-none">↑</span>
                </div>

                <div>
                  <p className="text-xs font-semibold mb-1.5" style={{ color: INK_3 }}>Recipient address</p>
                  <FInput value={sAddr} onChange={setSAddr} placeholder="0x…" valid={sAddr ? isAddress(sAddr) || null : null} />
                  {sAddr && !isAddress(sAddr) && <p className="text-xs mt-1 text-red-500">Invalid address</p>}
                </div>

                <div>
                  <p className="text-xs font-semibold mb-1.5" style={{ color: INK_3 }}>Amount (USDC)</p>
                  <div className="flex gap-2 mb-2">
                    {['1','5','10'].map((a) => (
                      <button key={a} onClick={() => setSAmt(a)}
                        className="flex-1 py-2 rounded-xl text-sm font-semibold border transition-all"
                        style={{ background: sAmt===a ? ACCENT : SURF, color: sAmt===a ? 'white' : INK_2, borderColor: sAmt===a ? ACCENT : BORDER }}>
                        ${a}
                      </button>
                    ))}
                  </div>
                  <FInput value={sAmt} onChange={setSAmt} placeholder="0.00" type="number" large />
                </div>

                {(effS === 'idle' || effS === 'error') && (
                  <PillBtn onClick={() => void handleSend()}
                    disabled={!isAddress(sAddr) || !sAmt || parseFloat(sAmt) <= 0}
                    className="w-full py-3.5">
                    Send USDC →
                  </PillBtn>
                )}
                <TxStatusBadge step={effS} errorMsg={sErr} txHash={sHash} />
                {effS === 'success' && (
                  <button onClick={() => { setSStep('idle'); setSAddr(''); setSAmt(''); setSHash(undefined); sRef.current = false }}
                    className="text-xs font-medium underline text-center" style={{ color: INK_4 }}>
                    Send again
                  </button>
                )}
              </div>
            </Card>
          </motion.div>

          </motion.div>
          )}
          </AnimatePresence>
        </main>

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            COL 3 — RIGHT BENTO (340px)
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <aside className="hidden lg:flex flex-col shrink-0 p-5 gap-4 overflow-y-auto min-h-0"
          style={{ width: 340, borderLeft: `1px solid ${BORDER}`, background: CANVAS }}>
          <AnimatePresence mode="wait" initial={false}>
          {centreView === 'activity' ? (
            /* ── Activity mode: detail panel or placeholder ── */
            <motion.div key="detail-panel"
              initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }}
              transition={{ type: 'spring', stiffness: 260, damping: 28 }}
              className="flex-1 flex flex-col">
              <AnimatePresence mode="wait" initial={false}>
              {selectedGift ? (
                <motion.div key={selectedGift.commitment}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.16 }}>
                  <Card>
                    <div className="p-6 flex flex-col gap-5">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-4xl">{selectedGift.emoji}</span>
                          <div>
                            <p className="text-base font-bold leading-tight" style={{ color: INK }}>{selectedGift.label}</p>
                            <p className="text-xs mt-0.5" style={{ color: INK_4 }}>{selectedGift.date}</p>
                          </div>
                        </div>
                        <button onClick={() => setSelectedGift(null)}
                          className="w-7 h-7 rounded-full flex items-center justify-center text-neutral-400 hover:bg-neutral-100 transition-colors shrink-0 text-lg leading-none">
                          ×
                        </button>
                      </div>
                      {/* Amount */}
                      <div className="px-4 py-3.5 rounded-2xl" style={{ background: CANVAS }}>
                        <Micro>Amount locked</Micro>
                        <p className="text-3xl font-bold tabular-nums mt-1" style={{ color: INK }}>
                          {selectedGift.amount} <span className="text-lg font-semibold" style={{ color: INK_3 }}>USDC</span>
                        </p>
                      </div>
                      {/* Status */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold" style={{ color: INK_3 }}>Onchain status</span>
                        <StatusPill commitment={selectedGift.commitment} />
                      </div>
                      {/* Gift link */}
                      <div>
                        <Micro>Gift link</Micro>
                        <div className="flex items-center gap-2 mt-1.5 px-3 py-2.5 rounded-2xl"
                          style={{ background: CANVAS, border: `1px solid ${BORDER}` }}>
                          <span className="flex-1 truncate text-[11px] font-mono" style={{ color: INK_3 }}>
                            {selectedGift.giftUrl.length > 36 ? `${selectedGift.giftUrl.slice(0,36)}…` : selectedGift.giftUrl}
                          </span>
                          <motion.button
                            whileTap={{ scale: 0.9 }}
                            onClick={() => void navigator.clipboard.writeText(selectedGift.giftUrl)}
                            className="shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-xl"
                            style={{ background: SURF, color: INK_2, border: `1px solid ${BORDER}` }}>
                            Copy
                          </motion.button>
                        </div>
                      </div>
                      {/* Reclaim if expired and unclaimed */}
                      <RefundPanel commitment={selectedGift.commitment}
                        onRefunded={() => void refetchBal()} />
                      {/* Arc Explorer — the app runs on Arc Testnet, and a commitment is
                          not a tx hash, so link the escrow contract rather than /tx/<commitment>. */}
                      <a href={`https://explorer.testnet.arc.io/address/${CONTRACT_ADDRESS}`}
                        target="_blank" rel="noreferrer"
                        className="text-xs font-semibold text-center py-2.5 rounded-full border transition-colors hover:bg-neutral-50"
                        style={{ color: INK_2, borderColor: BORDER }}>
                        View contract on Arc Explorer ↗
                      </a>
                    </div>
                  </Card>
                </motion.div>
              ) : (
                <motion.div key="placeholder"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  transition={{ duration: 0.16 }}
                  className="flex-1 flex flex-col items-center justify-center gap-3 rounded-[28px] py-20 text-center"
                  style={{ border: `1.5px dashed ${BORDER}`, minHeight: 300 }}>
                  {/* Cursor icon */}
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="text-neutral-300">
                    <path d="M4 4l7.07 17 2.51-7.39L21 11.07z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
                  </svg>
                  <p className="text-sm font-medium" style={{ color: INK_4 }}>Select a transaction<br />to view its details</p>
                </motion.div>
              )}
              </AnimatePresence>
            </motion.div>
          ) : (
            /* ── Default mode: Receive/Withdraw + Network Stats ── */
            <motion.div key="default-right"
              initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }}
              transition={{ type: 'spring', stiffness: 260, damping: 28 }}
              className="flex flex-col gap-4 w-full">

              {/* Card A — Receive / Withdraw */}
              <Card>
                <div className="p-5 flex flex-col gap-5">
                  <div className="flex rounded-xl p-0.5" style={{ background: CANVAS }}>
                    {(['receive','withdraw'] as RightTab[]).map((t) => (
                      <button key={t} onClick={() => setRightTab(t)}
                        className="flex-1 py-2 rounded-[10px] text-xs font-semibold transition-all capitalize"
                        style={{ background: rightTab===t ? SURF : 'transparent', color: rightTab===t ? INK : INK_4,
                          boxShadow: rightTab===t ? '0 1px 4px rgba(0,0,0,0.08)' : 'none' }}>
                        {t === 'receive' ? '↓ Receive' : '↑ Withdraw'}
                      </button>
                    ))}
                  </div>
                  <AnimatePresence mode="wait" initial={false}>
                    {rightTab === 'receive'
                      ? <motion.div key="rcv" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.16 }}>{receivePanelJsx}</motion.div>
                      : <motion.div key="wd"  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.16 }}>{withdrawPanelJsx}</motion.div>
                    }
                  </AnimatePresence>
                </div>
              </Card>

              {/* Card B — Network stats */}
              <Card>
                <div className="p-5 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <Micro>Network</Micro>
                    <span className="flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-0.5 rounded-full"
                      style={{ background: '#DCFCE7', color: '#15803D' }}>
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />Live
                    </span>
                  </div>
                  <h2 className="text-base font-bold" style={{ color: INK }}>Arc Network Stats</h2>
                  {[
                    { dot: '#3B82F6', label: 'Gas paid in', value: 'Native USDC' },
                    { dot: '#10B981', label: 'Finality',    value: 'Sub-second (~350ms)' },
                    { dot: '#F59E0B', label: 'Protocol',    value: 'Arc Testnet (5042002)' },
                  ].map((r) => (
                    <div key={r.label} className="flex items-center justify-between py-2.5 border-t" style={{ borderColor: BORDER }}>
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: r.dot }} />
                        <span className="text-xs font-medium" style={{ color: INK_3 }}>{r.label}</span>
                      </div>
                      <span className="text-xs font-semibold" style={{ color: INK }}>{r.value}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </motion.div>
          )}
          </AnimatePresence>
        </aside>
      </div>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          MOBILE BOTTOM DRAWER
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <AnimatePresence>
        {drawer && (
          <>
            <motion.div className="fixed inset-0 bg-black/40 z-40 lg:hidden"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setDrawer(false)} />
            <motion.div
              className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-white rounded-t-[28px] p-6"
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              style={{ maxHeight: '88dvh', overflowY: 'auto' }}>
              <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: '#E5E7EB' }} />
              <div className="flex flex-col gap-5">
                <div className="flex rounded-xl p-0.5" style={{ background: CANVAS }}>
                  {(['receive','withdraw'] as RightTab[]).map((t) => (
                    <button key={t} onClick={() => setRightTab(t)}
                      className="flex-1 py-2.5 rounded-[10px] text-xs font-semibold transition-all capitalize"
                      style={{ background: rightTab===t ? SURF : 'transparent', color: rightTab===t ? INK : INK_4,
                        boxShadow: rightTab===t ? '0 1px 4px rgba(0,0,0,0.08)' : 'none' }}>
                      {t === 'receive' ? '↓ Receive' : '↑ Withdraw'}
                    </button>
                  ))}
                </div>
                <AnimatePresence mode="wait" initial={false}>
                  {rightTab === 'receive'
                    ? <motion.div key="rcv2" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.16 }}>{receivePanelJsx}</motion.div>
                    : <motion.div key="wd2"  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.16 }}>{withdrawPanelJsx}</motion.div>
                  }
                </AnimatePresence>
                <button onClick={() => setDrawer(false)}
                  className="w-full py-3 rounded-full text-sm font-semibold border border-black/10" style={{ color: INK_2 }}>
                  Done
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
