/**
 * Dashboard — AskLoyal-inspired 3-column bento layout.
 * Warm off-white canvas, pure white bento cards, hairline borders, no thick outlines.
 * Clean typography & badges without icon/emoji clutter.
 * Unified Send flow (Direct Transfer + Scratch Gift) & Dedicated Deposit/Receive Hub.
 */
import { useState, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePrivy, useWallets } from '@privy-io/react-auth'
import { useBalance, useWaitForTransactionReceipt, usePublicClient } from 'wagmi'
import { formatEther, formatUnits, isAddress, parseAbiItem, parseEther } from 'viem'
import { arcTestnet } from 'viem/chains'
import QRCode from 'qrcode'
import MascotSVG from './MascotSVG'
import TxStatusBadge from './TxStatusBadge'
import GiftCreator from './GiftCreator'
import { CONTRACT_ADDRESS, CONTRACT_ADDRESS_V3, CONTRACT_ADDRESS_V2, useRefundGift, useCancelGift } from '@/hooks/useGiftContract'
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
 * "Expired" without a reload.
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
interface ReceivedGift {
  amount: string
  sender?: string
  date: string
  txHash?: `0x${string}`
}
type TxStep   = 'idle' | 'sending' | 'confirming' | 'success' | 'error'
type SendMode = 'direct' | 'gift'

// ── localStorage helpers ──────────────────────────────────────────────────────
function lsGet<T>(key: string, fb: T): T {
  try { return (JSON.parse(localStorage.getItem(key) ?? 'null') as T | null) ?? fb } catch { return fb }
}
function lsSet(key: string, val: unknown) {
  try { localStorage.setItem(key, JSON.stringify(val)) } catch { /* ignore */ }
}

// ── Balance formatting ────────────────────────────────────────────────────────
function formatTotalBal(raw: string | null): string {
  if (!raw) return '0.00'
  const [i, d = '00'] = raw.split('.')
  const numI = parseInt(i, 10)
  const formattedI = isNaN(numI) ? '0' : numI.toLocaleString('en-US')
  let trimmed = d.replace(/0+$/, '')
  if (trimmed.length < 2) trimmed = (trimmed + '00').slice(0, 2)
  return `${formattedI}.${trimmed}`
}

function splitBal(raw: string | null) {
  if (!raw) return { int: '—', dec: '' }
  const [i, d = '0000'] = raw.split('.')
  return { int: i, dec: d.slice(0, 4) }
}

// ── Status pill ───────────────────────────────────────────────────────────────
function StatusPill({ commitment }: { commitment: `0x${string}` }) {
  const nowSec = useNowSec()
  const { expiresAt, claimed, exists } = useGiftBalance(commitment)
  const base = 'text-[11px] font-semibold tracking-wide px-2.5 py-0.5 rounded-full'
  if (!exists) return <span className={`${base} bg-neutral-100 text-neutral-400`}>…</span>
  if (claimed) return <span className={`${base} bg-neutral-900 text-white`}>Claimed</span>
  if (expiresAt && Math.floor(expiresAt / 1000) < nowSec) return <span className={`${base} bg-neutral-100 text-neutral-400`}>Expired</span>
  return <span className={`${base} bg-blue-50 text-blue-700`}>Pending</span>
}

// ── Reclaim / Cancel gift ────────────────────────────────────────────────────
function RefundPanel({ commitment, onRefunded }: {
  commitment: `0x${string}`; onRefunded?: () => void
}) {
  const nowSec = useNowSec()
  const { expiresAt, claimed, exists, isV3, ephemeralAddress, refetch } = useGiftBalance(commitment)
  const { refundGift, step: refundStep, errorMsg: refundErr, txHash: refundHash, reset: resetRefund } = useRefundGift(() => {
    void refetch()
    onRefunded?.()
  })

  const { cancelGift, step: cancelStep, errorMsg: cancelErr, txHash: cancelHash, reset: resetCancel } = useCancelGift(() => {
    void refetch()
    onRefunded?.()
  })

  const activeStep = cancelStep !== 'idle' ? cancelStep : refundStep
  const activeErr = cancelErr || refundErr
  const activeHash = cancelHash || refundHash

  useEffect(() => {
    resetRefund()
    resetCancel()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commitment])

  if (activeStep === 'success') {
    return <TxStatusBadge step={activeStep} txHash={activeHash} />
  }

  if (claimed || !exists) return null

  const isExpired = expiresAt !== null && Math.floor(expiresAt / 1000) < nowSec
  const busy = activeStep === 'sending' || activeStep === 'confirming'

  // If expired, anyone can trigger a refund back to sender
  if (isExpired) {
    return (
      <div className="flex flex-col gap-2.5">
        <TxStatusBadge step={activeStep} errorMsg={activeErr} txHash={activeHash} />
        <motion.button
          whileTap={{ scale: 0.98 }}
          disabled={busy}
          onClick={() => void refundGift(ephemeralAddress ?? commitment, !isV3)}
          className="text-xs font-semibold py-2.5 rounded-full text-white transition-opacity disabled:opacity-50"
          style={{ background: ACCENT }}>
          {busy ? 'Reclaiming…' : 'Reclaim Expired USDC'}
        </motion.button>
        <p className="text-[11px] text-center" style={{ color: INK_4 }}>
          This gift expired unclaimed — send the USDC back to your wallet.
        </p>
      </div>
    )
  }

  // If not expired, V3 gifts allow the sender to cancel immediately!
  if (isV3 && ephemeralAddress) {
    return (
      <div className="flex flex-col gap-2.5">
        <TxStatusBadge step={activeStep} errorMsg={activeErr} txHash={activeHash} />
        <motion.button
          whileTap={{ scale: 0.98 }}
          disabled={busy}
          onClick={() => void cancelGift(ephemeralAddress)}
          className="text-xs font-semibold py-2.5 rounded-full text-white transition-opacity disabled:opacity-50"
          style={{ background: '#DC2626' }}>
          {busy ? 'Cancelling…' : 'Cancel & Reclaim Now'}
        </motion.button>
        <p className="text-[11px] text-center" style={{ color: INK_4 }}>
          Sender rescue: Cancel this unclaimed gift and immediately refund the USDC.
        </p>
      </div>
    )
  }

  return expiresAt === null ? null : (
    <p className="text-[11px] text-center" style={{ color: INK_4 }}>
      Refundable after {new Date(expiresAt).toLocaleDateString()} if unclaimed.
    </p>
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

// ── Eye icon for privacy toggle ───────────────────────────────────────────────
function EyeIcon({ hidden, size = 20 }: { hidden: boolean; size?: number }) {
  if (hidden) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
        <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
        <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
        <line x1="2" x2="22" y1="2" y2="22" />
      </svg>
    )
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
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
  const [histTab, setHistTab]         = useState<'sent' | 'received'>('sent')
  const [copied, setCopied]           = useState(false)
  const [drawerSheet, setDrawerSheet] = useState<'send' | 'receive' | null>(null)
  const [balHidden, setBalHidden]     = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [centreView, setCentreView]     = useState<'home' | 'activity'>('home')
  const [selectedGift, setSelectedGift] = useState<SentGift | null>(null)
  const [selectedReceivedGift, setSelectedReceivedGift] = useState<ReceivedGift | null>(null)
  const profileRef = useRef<HTMLDivElement>(null)

  // Unified Send State
  const [sendMode, setSendMode] = useState<SendMode>('direct')
  const [sAddr, setSAddr]   = useState('')
  const [sLabel, setSLabel] = useState('')
  const [sSave, setSSave]   = useState(false)
  const [sAmt, setSAmt]     = useState('')
  const [sStep, setSStep]   = useState<TxStep>('idle')
  const [sHash, setSHash]   = useState<`0x${string}` | undefined>()
  const [sErr, setSErr]     = useState<string | null>(null)
  const sRef = useRef(false)

  const [addrBook, setAddrBook] = useState<SavedAddress[]>(() => lsGet('sas_address_book', []))
  const [sentGifts]             = useState<SentGift[]>(() => lsGet('sas_sent_gifts', []))
  const [receivedGifts, setReceivedGifts] = useState<ReceivedGift[]>(() => lsGet('sas_received_gifts', []))
  const [isSyncingActivity, setIsSyncingActivity] = useState(false)
  const publicClient = usePublicClient({ chainId: arcTestnet.id })

  // Sync onchain received gifts for the connected wallet using direct RPC events (immune to ad blockers)
  const syncOnchainActivity = useCallback(async () => {
    if (!walletAddr) return
    setIsSyncingActivity(true)

    try {
      const onchainGifts: ReceivedGift[] = []

      // 1. Direct onchain RPC event query
      if (publicClient) {
        try {
          const event = parseAbiItem(
            'event GiftClaimed(address indexed ephemeralSigner, address indexed recipient, uint256 amount)',
          )
          const latestBlock = await publicClient.getBlockNumber()
          const V3_DEPLOY_BLOCK = 63628000n
          const CHUNK_SIZE = 4000n

          const ranges = []
          for (let from = V3_DEPLOY_BLOCK; from <= latestBlock; from += CHUNK_SIZE) {
            const to = from + CHUNK_SIZE - 1n > latestBlock ? latestBlock : from + CHUNK_SIZE - 1n
            ranges.push({ from, to })
          }

          const recentRanges = ranges.slice(-6)

          const allLogs = await Promise.all(
            recentRanges.map((r) =>
              publicClient
                .getLogs({
                  address: CONTRACT_ADDRESS_V3,
                  event,
                  args: { recipient: walletAddr },
                  fromBlock: r.from,
                  toBlock: r.to,
                })
                .catch(() => []),
            ),
          )

          const flatLogs = allLogs.flat()
          for (const l of flatLogs) {
            const amount = parseFloat(formatUnits(l.args.amount ?? 0n, 18)).toFixed(2)
            onchainGifts.push({
              amount,
              sender: l.args.ephemeralSigner,
              date: new Date().toLocaleDateString(),
              txHash: l.transactionHash as `0x${string}`,
            })
          }
        } catch {
          // RPC event check failed, ignore safely
        }
      }

      // 2. Secondary fallback via Vite proxy or Explorer
      if (onchainGifts.length === 0) {
        try {
          const proxyUrl = `/api/arc-explorer/api/v2/addresses/${walletAddr}/internal-transactions`
          const res = await fetch(proxyUrl).catch(() => null)
          if (res && res.ok) {
            const data = await res.json()
            const items = (data.items || []) as Array<{
              from?: { hash: string }
              value: string
              timestamp: string
              transaction_hash: string
            }>
            const knownContracts = [
              CONTRACT_ADDRESS_V3.toLowerCase(),
              CONTRACT_ADDRESS_V2.toLowerCase(),
              '0x5cc65165570799bdde45f0307fd8be8186e2f6ba'.toLowerCase(),
            ]
            const explorerGifts = items
              .filter((it) => knownContracts.includes((it.from?.hash || '').toLowerCase()))
              .map((it) => ({
                amount: (Number(BigInt(it.value)) / 1e18).toFixed(2),
                sender: it.from?.hash,
                date: new Date(it.timestamp).toLocaleDateString(),
                txHash: it.transaction_hash as `0x${string}`,
              }))
            onchainGifts.push(...explorerGifts)
          }
        } catch {
          // Silently ignore if blocked
        }
      }

      // Merge onchain discoveries with local state
      setReceivedGifts((prev) => {
        const map = new Map<string, ReceivedGift>()
        prev.forEach((g) => {
          const key = g.txHash || `${g.amount}-${g.date}`
          map.set(key, g)
        })
        onchainGifts.forEach((g) => {
          const key = g.txHash || `${g.amount}-${g.date}`
          map.set(key, { ...map.get(key), ...g })
        })
        const merged = Array.from(map.values())
        lsSet('sas_received_gifts', merged)
        return merged
      })
    } catch {
      // Graceful completion
    } finally {
      setIsSyncingActivity(false)
    }
  }, [walletAddr, publicClient])

  useEffect(() => {
    void syncOnchainActivity()
  }, [syncOnchainActivity])

  // If user has received gifts but no sent gifts, auto-switch to received tab
  useEffect(() => {
    if (sentGifts.length === 0 && receivedGifts.length > 0) {
      setHistTab('received')
    }
  }, [sentGifts.length, receivedGifts.length])

  const { isSuccess: sOk } = useWaitForTransactionReceipt({ hash: sHash, chainId: arcTestnet.id, query: { enabled: Boolean(sHash) } })
  const effS: TxStep = sStep === 'confirming' && sOk ? 'success' : sStep
  useEffect(() => { if (sOk && !sRef.current) { sRef.current = true; void refetchBal() } }, [sOk, refetchBal])

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

  function maxSend() {
    if (balRaw) {
      const val = Math.max(0, parseFloat(balRaw) - 0.001)
      setSAmt(val.toFixed(4))
    }
  }

  async function handleSend() {
    if (!isAddress(sAddr) || !sAmt || parseFloat(sAmt) <= 0) return
    if (sSave && sLabel.trim()) {
      const updated = [
        ...addrBook.filter((a) => a.address.toLowerCase() !== sAddr.toLowerCase()),
        { label: sLabel.trim(), address: sAddr }
      ]
      setAddrBook(updated)
      lsSet('sas_address_book', updated)
    }
    setSStep('sending')
    setSErr(null)
    try {
      const h = await sendTx(sAddr, sAmt)
      setSHash(h)
      setSStep('confirming')
    } catch (e) {
      setSErr(e instanceof Error ? e.message.split('\n')[0] : 'Send failed')
      setSStep('error')
    }
  }

  const displayName = user?.google?.name ?? user?.email?.address?.split('@')[0] ?? 'You'
  const shortAddr   = walletAddr ? `${walletAddr.slice(0,6)}…${walletAddr.slice(-4)}` : '—'

  // ── Deposit & Receive Hub Panel (Clean text, no icons) ──
  const depositPanelJsx = (
    <div className="flex flex-col gap-4">
      {/* QR Code Container */}
      <div className="flex flex-col items-center gap-3 p-4 rounded-2xl bg-neutral-50 border" style={{ borderColor: BORDER }}>
        {qrUrl
          ? <img src={qrUrl} alt="Wallet QR" className="rounded-xl bg-white p-1" style={{ width: 168, height: 168, border: `1px solid ${BORDER}` }} />
          : <div className="rounded-xl animate-pulse bg-neutral-200" style={{ width: 168, height: 168 }} />
        }
        <p className="text-[11px] font-medium text-center" style={{ color: INK_4 }}>
          Scan to receive native USDC on Arc
        </p>
      </div>

      {/* Wallet Address & Copy */}
      <div className="flex items-center gap-2 w-full px-3 py-2.5 rounded-2xl"
        style={{ background: CANVAS, border: `1px solid ${BORDER}` }}>
        <span className="flex-1 truncate text-xs font-mono" style={{ color: INK_3 }}>{walletAddr ?? '—'}</span>
        <motion.button onClick={copyAddr} whileTap={{ scale: 0.95 }}
          className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all"
          style={{ background: copied ? '#DCFCE7' : SURF, color: copied ? '#15803D' : INK_2, border: `1px solid ${copied ? '#86EFAC' : BORDER}` }}>
          {copied ? 'Copied' : 'Copy'}
        </motion.button>
      </div>

      {/* Deposit Rails (Text Cards) */}
      <div className="flex flex-col gap-2">
        <Micro>Deposit Methods</Micro>

        {/* Option 1: Arc Direct */}
        <div className="p-3 rounded-2xl border" style={{ background: SURF, borderColor: BORDER }}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold" style={{ color: INK }}>Arc Direct</span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">Native</span>
          </div>
          <p className="text-[11px] mt-1 leading-relaxed" style={{ color: INK_3 }}>
            Transfer native USDC from another Arc wallet directly to this address.
          </p>
        </div>

        {/* Option 2: Circle CCTP */}
        <div className="p-3 rounded-2xl border" style={{ background: SURF, borderColor: BORDER }}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold" style={{ color: INK }}>Circle CCTP</span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700">Cross-Chain</span>
          </div>
          <p className="text-[11px] mt-1 leading-relaxed" style={{ color: INK_3 }}>
            Burn-and-mint native cross-chain transfer from Ethereum, Arbitrum, or Base via CCTP.
          </p>
        </div>

        {/* Option 3: Testnet Faucet */}
        <div className="p-3 rounded-2xl border" style={{ background: SURF, borderColor: BORDER }}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold" style={{ color: INK }}>Testnet Faucet</span>
            <a
              href="https://faucet.testnet.arc.network"
              target="_blank"
              rel="noreferrer"
              className="text-[11px] font-semibold underline text-blue-600 hover:text-blue-800"
            >
              Request USDC
            </a>
          </div>
          <p className="text-[11px] mt-1 leading-relaxed" style={{ color: INK_3 }}>
            Fund your testnet account with free test USDC for development and testing.
          </p>
        </div>
      </div>
    </div>
  )

  // ── Send Form JSX (shared between desktop card and mobile sheet) ──
  const sendFormJsx = (
    <div className="flex flex-col gap-4">
      {/* Address Book Chips (if any) */}
      {addrBook.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold mb-1.5" style={{ color: INK_4 }}>Saved Contacts</p>
          <div className="flex flex-wrap gap-1.5">
            {addrBook.map((a) => (
              <button
                key={a.address}
                onClick={() => { setSAddr(a.address); setSLabel(a.label) }}
                className="text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-all"
                style={{
                  background: sAddr.toLowerCase() === a.address.toLowerCase() ? ACCENT : SURF,
                  color: sAddr.toLowerCase() === a.address.toLowerCase() ? 'white' : INK_2,
                  borderColor: sAddr.toLowerCase() === a.address.toLowerCase() ? ACCENT : BORDER
                }}>
                {a.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Recipient Input */}
      <div>
        <p className="text-xs font-semibold mb-1.5" style={{ color: INK_3 }}>Recipient address</p>
        <FInput
          value={sAddr}
          onChange={setSAddr}
          placeholder="0x…"
          valid={sAddr ? isAddress(sAddr) || null : null}
        />
        {sAddr && !isAddress(sAddr) && <p className="text-xs mt-1 text-red-500">Invalid Ethereum / Arc address</p>}
      </div>

      {/* Save to contacts toggle */}
      <div className="flex items-center gap-2.5">
        <button
          onClick={() => setSSave((v) => !v)}
          className="w-9 h-5 rounded-full relative shrink-0 transition-colors"
          style={{ background: sSave ? ACCENT : '#D1D5DB' }}>
          <motion.div
            animate={{ x: sSave ? 16 : 2 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm"
          />
        </button>
        <span className="text-xs font-medium" style={{ color: INK_3 }}>Save address to contacts</span>
      </div>

      {sSave && (
        <input
          type="text"
          value={sLabel}
          onChange={(e) => setSLabel(e.target.value)}
          placeholder="Contact label (e.g. My MetaMask, Alice)"
          className="w-full bg-neutral-50 border rounded-xl px-3 py-2.5 text-sm outline-none"
          style={{ color: INK, borderColor: BORDER }}
        />
      )}

      {/* Amount & Presets */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-xs font-semibold" style={{ color: INK_3 }}>Amount (USDC)</p>
          <button
            onClick={maxSend}
            className="text-xs font-bold underline"
            style={{ color: BLUE }}
          >
            Max
          </button>
        </div>

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
        {balRaw && (
          <p className="text-[11px] mt-1.5 font-medium" style={{ color: INK_4 }}>
            Available: {balRaw} USDC · Gas reserved: ~0.001 USDC
          </p>
        )}
      </div>

      {/* Submit Button */}
      {(effS === 'idle' || effS === 'error') && (
        <PillBtn onClick={() => void handleSend()}
          disabled={!isAddress(sAddr) || !sAmt || parseFloat(sAmt) <= 0}
          className="w-full py-3.5">
          Send USDC
        </PillBtn>
      )}
      <TxStatusBadge step={effS} errorMsg={sErr} txHash={sHash} />
      {effS === 'success' && (
        <button onClick={() => { setSStep('idle'); setSAddr(''); setSAmt(''); setSHash(undefined); setSLabel(''); setSSave(false); sRef.current = false }}
          className="text-xs font-medium underline text-center" style={{ color: INK_4 }}>
          Send another transfer
        </button>
      )}
    </div>
  )

  // ── Received gift detail content ─────────────────────────────────────────────
  const receivedDetailJsx = selectedReceivedGift ? (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-50 text-emerald-700">
            Received Gift
          </span>
          <p className="text-base font-bold leading-tight mt-1" style={{ color: INK }}>Gift Claimed</p>
          <p className="text-xs mt-0.5" style={{ color: INK_4 }}>{selectedReceivedGift.date}</p>
        </div>
        <button onClick={() => setSelectedReceivedGift(null)}
          className="text-xs font-semibold px-2.5 py-1 rounded-full bg-neutral-100 text-neutral-600 hover:bg-neutral-200 transition-colors">
          Close
        </button>
      </div>

      {/* Amount */}
      <div className="px-4 py-3.5 rounded-2xl" style={{ background: CANVAS }}>
        <Micro>Amount received</Micro>
        <p className="text-3xl font-bold tabular-nums mt-1" style={{ color: INK }}>
          {selectedReceivedGift.amount} <span className="text-lg font-semibold" style={{ color: INK_3 }}>USDC</span>
        </p>
      </div>

      {/* Status */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold" style={{ color: INK_3 }}>Onchain status</span>
        <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
          Claimed
        </span>
      </div>

      {/* Sender if known */}
      {selectedReceivedGift.sender && (
        <div>
          <Micro>From Sender</Micro>
          <div className="flex items-center gap-2 mt-1.5 px-3 py-2.5 rounded-2xl"
            style={{ background: CANVAS, border: `1px solid ${BORDER}` }}>
            <span className="flex-1 truncate text-[11px] font-mono text-neutral-600">
              {selectedReceivedGift.sender}
            </span>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => void navigator.clipboard.writeText(selectedReceivedGift.sender!)}
              className="shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-xl"
              style={{ background: SURF, color: INK_2, border: `1px solid ${BORDER}` }}>
              Copy
            </motion.button>
          </div>
        </div>
      )}

      {/* Transaction Hash */}
      {selectedReceivedGift.txHash && (
        <div>
          <Micro>Transaction Hash</Micro>
          <div className="flex items-center gap-2 mt-1.5 px-3 py-2.5 rounded-2xl"
            style={{ background: CANVAS, border: `1px solid ${BORDER}` }}>
            <span className="flex-1 truncate text-[11px] font-mono text-neutral-600">
              {selectedReceivedGift.txHash}
            </span>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => void navigator.clipboard.writeText(selectedReceivedGift.txHash!)}
              className="shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-xl"
              style={{ background: SURF, color: INK_2, border: `1px solid ${BORDER}` }}>
              Copy
            </motion.button>
          </div>
        </div>
      )}

      {/* Arc Explorer Link */}
      {selectedReceivedGift.txHash ? (
        <a href={`https://explorer.testnet.arc.io/tx/${selectedReceivedGift.txHash}`}
          target="_blank" rel="noreferrer"
          className="text-xs font-semibold text-center py-2.5 rounded-full border transition-colors hover:bg-neutral-50"
          style={{ color: INK_2, borderColor: BORDER }}>
          View transaction on Arc Explorer
        </a>
      ) : (
        <a href={`https://explorer.testnet.arc.io/address/${CONTRACT_ADDRESS}`}
          target="_blank" rel="noreferrer"
          className="text-xs font-semibold text-center py-2.5 rounded-full border transition-colors hover:bg-neutral-50"
          style={{ color: INK_2, borderColor: BORDER }}>
          View contract on Arc Explorer
        </a>
      )}
    </div>
  ) : null

  // ── Sent gift detail content ───────────────────────────────────────────────
  const sentDetailJsx = selectedGift ? (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-50 text-blue-700">
            Scratch Gift
          </span>
          <p className="text-base font-bold leading-tight mt-1" style={{ color: INK }}>{selectedGift.label}</p>
          <p className="text-xs mt-0.5" style={{ color: INK_4 }}>{selectedGift.date}</p>
        </div>
        <button onClick={() => setSelectedGift(null)}
          className="text-xs font-semibold px-2.5 py-1 rounded-full bg-neutral-100 text-neutral-600 hover:bg-neutral-200 transition-colors">
          Close
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
            {selectedGift.giftUrl.length > 36 ? `${selectedGift.giftUrl.slice(0, 36)}…` : selectedGift.giftUrl}
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

      {/* Arc Explorer */}
      <a href={`https://explorer.testnet.arc.io/address/${CONTRACT_ADDRESS}`}
        target="_blank" rel="noreferrer"
        className="text-xs font-semibold text-center py-2.5 rounded-full border transition-colors hover:bg-neutral-50"
        style={{ color: INK_2, borderColor: BORDER }}>
        View contract on Arc Explorer
      </a>
    </div>
  ) : null

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="h-dvh w-full overflow-hidden flex flex-col" style={{ background: CANVAS, fontFamily: "'Inter','SF Pro Display',system-ui,sans-serif" }}>

      {/* ── Mobile top nav: Activity on left, Profile on right ── */}
      <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-white border-b" style={{ borderColor: BORDER }}>

        {/* Left: Activity toggle */}
        <button
          onClick={() => { setCentreView(v => v === 'activity' ? 'home' : 'activity'); setSelectedGift(null) }}
          className="px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors"
          style={{ background: centreView === 'activity' ? ACCENT : '#F3F4F6', color: centreView === 'activity' ? 'white' : INK_3 }}>
          {centreView === 'activity' ? 'Overview' : 'Activity'}
        </button>

        {/* Right: profile chip + dropdown */}
        <div className="relative" ref={profileRef}>
          <button onClick={() => setProfileOpen(v => !v)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-2xl transition-colors"
            style={{ background: CANVAS, border: `1px solid ${BORDER}` }}>
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
              style={{ background: ACCENT }}>
              {displayName.charAt(0).toUpperCase()}
            </div>
            <span className="text-[11px] font-semibold max-w-[80px] truncate" style={{ color: INK }}>{displayName}</span>
            <span className="text-[10px]" style={{ color: INK_4 }}>Menu</span>
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
                  className="w-full flex items-center justify-between px-4 py-3 text-xs font-medium hover:bg-neutral-50 transition-colors"
                  style={{ color: INK_2 }}>
                  <span>Copy address</span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-neutral-100">{copied ? 'Copied' : 'Copy'}</span>
                </button>
                <div style={{ height: 1, background: BORDER }} />
                {/* Sign out */}
                <button onClick={() => { setProfileOpen(false); void logout() }}
                  className="w-full text-left px-4 py-3 text-xs font-semibold hover:bg-red-50 transition-colors"
                  style={{ color: '#EF4444' }}>
                  Sign out
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

          <div className="flex flex-col gap-6">
            {/* Brand & Activity toggle */}
            <div className="flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <MascotSVG size={32} animate={false} expression="happy" />
                <p className="text-sm font-bold tracking-tight" style={{ color: INK }}>scratch &amp; split</p>
              </div>
              <button
                onClick={() => { setCentreView(v => v === 'activity' ? 'home' : 'activity'); setSelectedGift(null) }}
                className="px-3 py-1 rounded-full text-xs font-semibold transition-all shrink-0"
                style={{ background: centreView === 'activity' ? ACCENT : '#F3F4F6', color: centreView === 'activity' ? 'white' : INK_3 }}>
                Activity
              </button>
            </div>

            {/* Sidebar body — Total Balance card */}
            <div className="flex flex-col">
              <div
                onClick={() => setBalHidden((v) => !v)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setBalHidden((v) => !v) } }}
                className="w-full text-left p-4 rounded-2xl border transition-all hover:bg-neutral-50/70 cursor-pointer select-none"
                style={{ background: CANVAS, borderColor: BORDER }}
                title={balHidden ? 'Click to show balance' : 'Click to hide balance'}
              >
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium" style={{ color: INK_3 }}>Total Balance</span>
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-2xl font-bold tracking-tight tabular-nums truncate" style={{ color: INK }}>
                      {balHidden ? '$••••••' : `$${formatTotalBal(balRaw)}`}
                    </div>
                    <span className="p-1 -mr-1 text-neutral-400 hover:text-neutral-700 transition-colors shrink-0">
                      <EyeIcon hidden={balHidden} size={18} />
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar footer */}
          <div className="flex flex-col gap-1">
            <div className="flex flex-col gap-1 mb-3">
              {[
                { label: 'Documentation', href: 'https://developers.circle.com' },
                { label: 'Arc Explorer',   href: 'https://explorer.testnet.arc.io' },
                { label: 'Testnet Faucet', href: 'https://faucet.testnet.arc.network' },
              ].map((l) => (
                <a key={l.label} href={l.href} target="_blank" rel="noreferrer"
                  className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium hover:bg-neutral-50 transition-colors"
                  style={{ color: INK_3 }}>
                  <span>{l.label}</span>
                  <span className="text-[10px] text-neutral-400">External</span>
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
                <span className="shrink-0 text-[10px] font-semibold text-neutral-400">Menu</span>
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
                      className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-neutral-50 transition-colors"
                      style={{ color: INK_2 }}>
                      <span>Copy address</span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-neutral-100">{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                    <div style={{ height: 1, background: BORDER }} />
                    <button
                      onClick={() => { setProfileOpen(false); void logout() }}
                      className="w-full text-left px-4 py-3 text-sm font-semibold hover:bg-red-50 transition-colors"
                      style={{ color: '#EF4444' }}>
                      Sign out
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
        <main className={`flex-1 flex flex-col p-4 lg:p-6 gap-5 min-h-0 pb-24 lg:pb-6 ${view === 'create' || centreView === 'activity' ? 'overflow-y-auto' : 'overflow-hidden'}`}>
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
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => void syncOnchainActivity()}
                      disabled={isSyncingActivity}
                      className="text-xs font-semibold px-3 py-1.5 rounded-xl border bg-white hover:bg-neutral-50 transition-all disabled:opacity-40"
                      style={{ borderColor: BORDER, color: INK_2 }}
                    >
                      {isSyncingActivity ? 'Syncing...' : 'Sync'}
                    </button>
                    {/* Sent / Received tabs */}
                    <div className="flex rounded-xl p-0.5 text-xs font-semibold" style={{ background: CANVAS }}>
                      {(['sent','received'] as const).map((t) => (
                        <button key={t} onClick={() => { setHistTab(t); setSelectedGift(null); setSelectedReceivedGift(null) }}
                          className="px-4 py-1.5 rounded-[10px] transition-all capitalize"
                          style={{ background: histTab===t ? SURF : 'transparent', color: histTab===t ? INK : INK_4,
                            boxShadow: histTab===t ? '0 1px 4px rgba(0,0,0,0.08)' : 'none' }}>
                          {t === 'sent' ? `Sent (${sentGifts.length})` : `Received (${receivedGifts.length})`}
                        </button>
                      ))}
                    </div>
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
                          onClick={() => { setSelectedGift(g); setSelectedReceivedGift(null); setDrawerSheet(null) }}
                          className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left transition-all hover:bg-neutral-50 active:scale-[0.99]"
                          style={{ background: selectedGift?.commitment === g.commitment ? CANVAS : 'transparent' }}>
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md bg-neutral-100 text-neutral-600 shrink-0">
                            Gift
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate" style={{ color: INK }}>{g.label}</p>
                            <p className="text-[11px] font-medium tabular-nums mt-0.5" style={{ color: INK_4 }}>{g.amount} USDC · {g.date}</p>
                          </div>
                          <StatusPill commitment={g.commitment} />
                        </motion.button>
                      ))
                    )
                  )}
                  {histTab === 'received' && (
                    receivedGifts.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center gap-3 py-16 text-center">
                        <MascotSVG size={56} animate={false} expression="thinking" />
                        <p className="text-sm font-semibold" style={{ color: INK_2 }}>
                          {isSyncingActivity ? 'Checking onchain activity…' : 'No activity yet'}
                        </p>
                        <p className="text-xs" style={{ color: INK_4 }}>Gifts you claim will appear here.</p>
                      </div>
                    ) : (
                      receivedGifts.slice().reverse().map((g, i) => (
                        <motion.button key={g.txHash ?? i}
                          initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.04 }}
                          onClick={() => { setSelectedReceivedGift(g); setSelectedGift(null); setDrawerSheet(null) }}
                          className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left transition-all hover:bg-neutral-50 active:scale-[0.99]"
                          style={{ background: (selectedReceivedGift === g || (g.txHash && selectedReceivedGift?.txHash === g.txHash)) ? CANVAS : 'transparent' }}>
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md bg-neutral-100 text-neutral-800 shrink-0">
                            Claimed
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate" style={{ color: INK }}>Gift received</p>
                            <p className="text-[11px] font-medium tabular-nums mt-0.5" style={{ color: INK_4 }}>{g.amount} USDC · {g.date}</p>
                          </div>
                          {g.txHash ? (
                            <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                              View
                            </span>
                          ) : (
                            <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-neutral-900 text-white shrink-0">
                              Claimed
                            </span>
                          )}
                        </motion.button>
                      ))
                    )
                  )}
                </div>
              </Card>
            </motion.div>
          ) : (
          <motion.div key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }} className="flex flex-col gap-5 flex-1 min-h-0">

          {/* Mobile-only Balance Card (above the hero card) */}
          <div className="lg:hidden">
            <Card className="p-5 sm:p-6">
              <div
                onClick={() => setBalHidden((v) => !v)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setBalHidden((v) => !v) } }}
                className="w-full text-left cursor-pointer select-none"
                title={balHidden ? 'Tap to reveal balance' : 'Tap to hide balance'}
              >
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium" style={{ color: INK_3 }}>Total Balance</span>
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-3xl sm:text-4xl font-extrabold tracking-tight tabular-nums" style={{ color: INK }}>
                      {balHidden ? '$••••••' : `$${formatTotalBal(balRaw)}`}
                    </div>
                    <span className="p-1.5 -mr-1 text-neutral-400 hover:text-neutral-700 transition-colors shrink-0">
                      <EyeIcon hidden={balHidden} size={22} />
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Hero card (matches user reference design) */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 220, damping: 26 }} className="flex-1 flex flex-col min-h-0">
            <Card className="relative flex-1 flex flex-col justify-between">
              {/* Dot grid */}
              <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
                style={{ backgroundImage: 'radial-gradient(circle,#000 1px,transparent 1px)', backgroundSize: '24px 24px' }} />

              <div className="relative z-10 flex flex-col justify-between p-6 sm:p-8 lg:p-10 flex-1">
                {/* Headline — enlarged to fill the card beautifully */}
                <h1 className="font-black uppercase leading-[0.98] tracking-tight"
                  style={{ fontSize: 'clamp(2.35rem,6.8vw,4.25rem)', color: INK }}>
                  Send a mystery<br />
                  <span style={{ color: INK_3 }}>scratch gift</span><br />
                  in under a<br className="sm:hidden" />
                  {' '}second
                </h1>

                {/* CTA + Ollie (without plus sign) */}
                <div className="mt-8 flex flex-row items-end justify-between gap-3">
                  <PillBtn onClick={() => setView('create')} className="px-6 py-3.5 text-sm lg:px-8 lg:py-4 lg:text-base shrink-0">
                    Create Scratch Gift
                  </PillBtn>
                  <div className="self-end shrink-0 opacity-95 pointer-events-none -mb-1 -mr-1">
                    <MascotSVG size={88} animate expression="excited" festive />
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Desktop-only Send Card (hidden on mobile, replaced by floating sheet) */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.07, type: 'spring', stiffness: 220, damping: 26 }}
            id="send-card" className="hidden lg:block">
            <Card>
              <div className="p-6 flex flex-col gap-5">
                {/* Header with inline mode switcher */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <Micro>Action</Micro>
                    <h2 className="text-lg font-bold mt-0.5" style={{ color: INK }}>Send</h2>
                  </div>

                  {/* Mode switcher tabs */}
                  <div className="flex rounded-xl p-0.5 text-xs font-semibold self-start sm:self-auto" style={{ background: CANVAS }}>
                    <button
                      onClick={() => setSendMode('direct')}
                      className="px-3.5 py-1.5 rounded-[10px] transition-all"
                      style={{
                        background: sendMode === 'direct' ? SURF : 'transparent',
                        color: sendMode === 'direct' ? INK : INK_4,
                        boxShadow: sendMode === 'direct' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none'
                      }}>
                      Direct Transfer
                    </button>
                    <button
                      onClick={() => setSendMode('gift')}
                      className="px-3.5 py-1.5 rounded-[10px] transition-all"
                      style={{
                        background: sendMode === 'gift' ? SURF : 'transparent',
                        color: sendMode === 'gift' ? INK : INK_4,
                        boxShadow: sendMode === 'gift' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none'
                      }}>
                      Scratch Gift
                    </button>
                  </div>
                </div>

                {sendMode === 'direct' ? sendFormJsx : (
                  /* Scratch Gift Mode */
                  <div className="flex flex-col gap-4 py-2">
                    <p className="text-xs leading-relaxed" style={{ color: INK_3 }}>
                      Create a gamified scratch card gift with an onchain USDC lock, secret claim link, and custom reveal message.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 py-1">
                      <div className="p-3 rounded-2xl border" style={{ background: CANVAS, borderColor: BORDER }}>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Security</p>
                        <p className="text-xs font-semibold mt-0.5" style={{ color: INK }}>EIP-712 Signature</p>
                        <p className="text-[11px] text-neutral-500 mt-1">Anti-MEV &amp; frontrun protection</p>
                      </div>
                      <div className="p-3 rounded-2xl border" style={{ background: CANVAS, borderColor: BORDER }}>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Gasless</p>
                        <p className="text-xs font-semibold mt-0.5" style={{ color: INK }}>Zero Gas for Claimer</p>
                        <p className="text-[11px] text-neutral-500 mt-1">Claim directly into any wallet</p>
                      </div>
                      <div className="p-3 rounded-2xl border" style={{ background: CANVAS, borderColor: BORDER }}>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Control</p>
                        <p className="text-xs font-semibold mt-0.5" style={{ color: INK }}>Sender Rescue</p>
                        <p className="text-[11px] text-neutral-500 mt-1">Cancel unclaimed gifts anytime</p>
                      </div>
                    </div>

                    <PillBtn onClick={() => setView('create')} className="w-full py-3.5">
                      Open Scratch Gift Creator
                    </PillBtn>
                  </div>
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
              {selectedReceivedGift ? (
                <motion.div key={selectedReceivedGift.txHash ?? 'rec-gift'}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.16 }}>
                  <Card>
                    <div className="p-6">
                      {receivedDetailJsx}
                    </div>
                  </Card>
                </motion.div>
              ) : selectedGift ? (
                <motion.div key={selectedGift.commitment}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.16 }}>
                  <Card>
                    <div className="p-6">
                      {sentDetailJsx}
                    </div>
                  </Card>
                </motion.div>
              ) : (
                <motion.div key="placeholder"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  transition={{ duration: 0.16 }}
                  className="flex-1 flex flex-col items-center justify-center gap-2 rounded-[28px] py-20 px-6 text-center"
                  style={{ border: `1.5px dashed ${BORDER}`, minHeight: 300 }}>
                  <p className="text-xs font-bold uppercase tracking-wider text-neutral-400">Transaction Details</p>
                  <p className="text-sm font-medium text-neutral-500">Select a sent or received gift to view its details</p>
                </motion.div>
              )}
              </AnimatePresence>
            </motion.div>
          ) : (
            /* ── Default mode: Deposit Hub + Network Specs ── */
            <motion.div key="default-right"
              initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }}
              transition={{ type: 'spring', stiffness: 260, damping: 28 }}
              className="flex flex-col gap-4 w-full">

              {/* Card A — Deposit / Receive Hub */}
              <Card>
                <div className="p-5 flex flex-col gap-4">
                  <div>
                    <Micro>Inbound</Micro>
                    <h2 className="text-base font-bold mt-0.5" style={{ color: INK }}>Deposit / Receive</h2>
                  </div>
                  {depositPanelJsx}
                </div>
              </Card>

              {/* Card B — Network specs */}
              <Card>
                <div className="p-5 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <Micro>Network</Micro>
                    <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Live
                    </span>
                  </div>
                  <h2 className="text-base font-bold" style={{ color: INK }}>Arc Network Specs</h2>
                  {[
                    { label: 'Gas paid in', value: 'Native USDC' },
                    { label: 'Finality',    value: 'Sub-second (~350ms)' },
                    { label: 'Chain ID',    value: '5042002 (Arc Testnet)' },
                  ].map((r) => (
                    <div key={r.label} className="flex items-center justify-between py-2 border-t" style={{ borderColor: BORDER }}>
                      <span className="text-xs font-medium" style={{ color: INK_3 }}>{r.label}</span>
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

      {/* ── Mobile bottom floating action bar ── */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 p-3 bg-white/95 backdrop-blur-md border-t flex gap-3 shadow-lg"
        style={{ borderColor: BORDER }}>
        <button
          onClick={() => { setDrawerSheet('send'); setSelectedGift(null); setSelectedReceivedGift(null) }}
          className="flex-1 py-3 rounded-2xl text-xs font-bold text-white shadow-sm transition-transform active:scale-95"
          style={{ background: ACCENT }}>
          Send
        </button>
        <button
          onClick={() => { setDrawerSheet('receive'); setSelectedGift(null); setSelectedReceivedGift(null) }}
          className="flex-1 py-3 rounded-2xl text-xs font-bold border transition-transform active:scale-95"
          style={{ background: SURF, color: INK, borderColor: BORDER }}>
          Receive
        </button>
      </div>

      {/* ── Mobile bottom drawer for Send and Receive ── */}
      <AnimatePresence>
        {drawerSheet && (
          <>
            <motion.div className="fixed inset-0 bg-black/40 z-40 lg:hidden"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setDrawerSheet(null)} />
            <motion.div
              className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-white rounded-t-[28px] p-6 shadow-2xl"
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              style={{ maxHeight: '88dvh', overflowY: 'auto' }}>
              <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: '#E5E7EB' }} />
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between pb-2 border-b" style={{ borderColor: BORDER }}>
                  <h3 className="text-lg font-bold" style={{ color: INK }}>
                    {drawerSheet === 'send' ? 'Send USDC' : 'Deposit / Receive Hub'}
                  </h3>
                  <button onClick={() => setDrawerSheet(null)} className="text-xs font-semibold px-2.5 py-1 rounded-full bg-neutral-100 text-neutral-600">
                    Close
                  </button>
                </div>
                {drawerSheet === 'send' ? sendFormJsx : depositPanelJsx}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Mobile bottom drawer for Activity Detail ── */}
      <AnimatePresence>
        {(selectedReceivedGift || selectedGift) && (
          <>
            <motion.div className="fixed inset-0 bg-black/40 z-40 lg:hidden"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => { setSelectedReceivedGift(null); setSelectedGift(null) }} />
            <motion.div
              className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-white rounded-t-[28px] p-6 shadow-2xl"
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              style={{ maxHeight: '88dvh', overflowY: 'auto' }}>
              <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: '#E5E7EB' }} />
              {selectedReceivedGift ? receivedDetailJsx : sentDetailJsx}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
