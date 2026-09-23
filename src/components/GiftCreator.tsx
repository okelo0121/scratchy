/**
 * GiftCreator — matches Dashboard bento design system exactly.
 * Off-white canvas, pure white rounded-[28px] cards, hairline borders,
 * black pill buttons, Inter typography. Zero purple/lavender.
 */
import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePrivy, useWallets } from '@privy-io/react-auth'
import { formatUnits } from 'viem'
import { useReadContract } from 'wagmi'
import { arcTestnet } from 'viem/chains'
import { erc20Abi } from 'viem'
import { generateSecretKey, computeCommitment, secretKeyToHex } from '@/lib/giftCrypto'
import { processPhoto, encodeGiftPayload, storePhoto } from '@/lib/imageStore'
import { useCreateGift } from '@/hooks/useGiftContract'
import TxStatusBadge from './TxStatusBadge'

// ── Design tokens (identical to Dashboard) ───────────────────────────────────
const INK    = '#111827'
const INK_2  = '#374151'
const INK_3  = '#6B7280'
const INK_4  = '#9CA3AF'
const CANVAS = '#F5F5F7'
const BORDER = 'rgba(0,0,0,0.06)'
const ACCENT = '#111827'
const FONT   = "'Inter','SF Pro Display',system-ui,sans-serif"

const AMOUNT_PILLS = ['1.00', '2.00', '5.00', '10.00']
const USDC_ADDRESS = '0x3600000000000000000000000000000000000000' as const
const EXPIRY_DAYS  = 30
const CAN_SHARE    = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

interface Props {
  preset?:  { amount: string; label: string }
  onBack:   () => void
  /** Called after success so parent can navigate away if desired */
  onDone?:  () => void
}

function Micro({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-[0.12em]"
      style={{ color: INK_4, fontFamily: FONT, ...style }}>
      {children}
    </p>
  )
}

function PillBtn({ children, onClick, disabled = false, outline = false, className = '' }: {
  children: React.ReactNode; onClick?: () => void
  disabled?: boolean; outline?: boolean; className?: string
}) {
  return (
    <motion.button
      onClick={onClick} disabled={disabled}
      whileHover={disabled ? {} : { scale: 1.02 }}
      whileTap={disabled ? {} : { scale: 0.97 }}
      className={`rounded-full font-bold text-sm transition-opacity disabled:opacity-40 ${className}`}
      style={{
        fontFamily: FONT,
        background: outline ? 'transparent' : ACCENT,
        color: outline ? INK_2 : 'white',
        border: outline ? `1.5px solid ${BORDER}` : 'none',
      }}
    >
      {children}
    </motion.button>
  )
}

export default function GiftCreator({ preset, onBack, onDone }: Props) {
  const { user } = usePrivy()
  const { wallets } = useWallets()
  const embeddedWallet = wallets.find((w) => w.walletClientType === 'privy') ?? wallets[0]
  const senderAddress  = embeddedWallet?.address as `0x${string}` | undefined

  const [step, setStep]                 = useState(1)
  const [amount, setAmount]             = useState(preset?.amount ?? '5.00')
  const [customAmount, setCustomAmount] = useState('')
  const [photo, setPhoto]               = useState<string | null>(null)
  const [message, setMessage]           = useState(preset ? `🎉 Happy ${preset.label}!` : '')
  const [giftUrl, setGiftUrl]           = useState<string | null>(null)
  const [copied, setCopied]             = useState(false)
  const [shared, setShared]             = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const giftUrlRef   = useRef<string | null>(null)

  useEffect(() => { giftUrlRef.current = giftUrl }, [giftUrl])

  const finalAmount = amount === 'custom' ? customAmount : amount

  const { data: balanceRaw } = useReadContract({
    address: USDC_ADDRESS, abi: erc20Abi, functionName: 'balanceOf',
    args: [senderAddress ?? '0x0000000000000000000000000000000000000000'],
    chainId: arcTestnet.id, query: { enabled: Boolean(senderAddress) },
  })
  const usdcBalance = balanceRaw !== undefined
    ? parseFloat(formatUnits(balanceRaw, 6)).toFixed(2) : null

  function handleSuccess(commitment: `0x${string}`) {
    try {
      const existing = JSON.parse(localStorage.getItem('sas_sent_gifts') ?? '[]') as object[]
      localStorage.setItem('sas_sent_gifts', JSON.stringify([...existing, {
        commitment, amount: finalAmount,
        label: preset?.label ?? 'Custom Surprise',
        emoji: preset ? (preset.label === 'Birthday' ? '🎂' : preset.label === 'Coffee Treat' ? '☕' : '🎉') : '🎁',
        date: new Date().toLocaleDateString(),
        giftUrl: giftUrlRef.current ?? '',
      }]))
    } catch { /* ignore */ }
  }

  function copyLink() {
    if (!giftUrl) return
    void navigator.clipboard.writeText(giftUrl).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2500)
    })
  }
  async function handleNativeShare() {
    if (!giftUrl || !CAN_SHARE) return
    try { await navigator.share({ title: 'You have a Scratch Gift!', text: 'Scratch to reveal your USDC surprise', url: giftUrl }); setShared(true) }
    catch { /* user cancelled */ }
  }
  function shareWhatsApp() {
    if (!giftUrl) return
    window.open(`https://wa.me/?text=${encodeURIComponent(`You have a scratch gift! Open this link to reveal your USDC: ${giftUrl}`)}`, '_blank')
  }
  function shareEmail() {
    if (!giftUrl) return
    window.open(`mailto:?subject=${encodeURIComponent('You have a Scratch Gift!')}&body=${encodeURIComponent(`Hey!\n\nI sent you a USDC scratch gift. Open this link to scratch the foil and claim your surprise:\n\n${giftUrl}\n\nEnjoy!`)}`)
  }

  const { createGift, step: txStep, errorMsg, txHash, reset } = useCreateGift(handleSuccess)

  const handlePhotoUpload = useCallback(async (file: File) => {
    try { setPhoto(await processPhoto(file)) } catch { /* ignore */ }
  }, [])

  async function handleSubmit() {
    if (!senderAddress) return
    const secretKey  = generateSecretKey()
    const commitment = computeCommitment(secretKey)
    const skHex      = secretKeyToHex(secretKey)
    if (photo) storePhoto(commitment, photo)
    const fragment = encodeGiftPayload(skHex, message, photo)
    setGiftUrl(`${window.location.origin}/#${fragment}`)
    await createGift(secretKey, finalAmount, EXPIRY_DAYS)
  }

  const displayName = user?.email?.address?.split('@')[0] ?? user?.google?.name ?? 'you'
  const STEP_LABELS = ['Amount', 'Photo', 'Message']

  // ── Success screen ──────────────────────────────────────────────────────────
  if (txStep === 'success' && giftUrl) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 24 }}
        className="rounded-[28px] overflow-hidden"
        style={{ background: '#FFFFFF', border: `1px solid ${BORDER}`, boxShadow: '0 2px 20px rgba(0,0,0,0.06)' }}
      >
        <div className="py-8 px-6 text-center" style={{ background: INK }}>
          <motion.div
            animate={{ rotate: [0, -12, 12, -8, 8, 0] }}
            transition={{ duration: 0.7, delay: 0.2 }}
            style={{ fontSize: 48, display: 'inline-block' }}
          >🎉</motion.div>
          <h2 className="mt-2 text-2xl font-black text-white" style={{ fontFamily: FONT, letterSpacing: '-0.03em' }}>
            Gift Created!
          </h2>
          <p className="text-sm mt-1" style={{ fontFamily: FONT, color: 'rgba(255,255,255,0.4)' }}>
            {finalAmount} USDC locked onchain · {EXPIRY_DAYS} days
          </p>
        </div>

        <div className="p-5 flex flex-col gap-4" style={{ background: CANVAS }}>
          <motion.button
            onClick={copyLink} whileTap={{ scale: 0.98 }}
            className="w-full rounded-2xl px-4 py-3 text-left"
            style={{ background: copied ? '#E0F2FE' : '#FFFFFF', border: `1px solid ${copied ? '#38BDF8' : BORDER}` }}
          >
            <Micro>{copied ? '✓ Copied!' : 'Tap to copy gift link'}</Micro>
            <p className="text-xs mt-1 truncate font-mono" style={{ color: INK_3 }}>{giftUrl}</p>
          </motion.button>

          <div className={`grid gap-2 ${CAN_SHARE ? 'grid-cols-3' : 'grid-cols-2'}`}>
            {CAN_SHARE && (
              <PillBtn onClick={() => void handleNativeShare()} className="py-3 flex flex-col items-center gap-1">
                <span style={{ fontSize: 18 }}>{shared ? '✓' : '↑'}</span>
                <span className="text-xs">Share</span>
              </PillBtn>
            )}
            <PillBtn onClick={shareWhatsApp} className="py-3 flex flex-col items-center gap-1">
              <span style={{ fontSize: 18 }}>💬</span>
              <span className="text-xs">WhatsApp</span>
            </PillBtn>
            <PillBtn onClick={shareEmail} className="py-3 flex flex-col items-center gap-1">
              <span style={{ fontSize: 18 }}>✉️</span>
              <span className="text-xs">Email</span>
            </PillBtn>
          </div>

          <p className="text-[11px] text-center" style={{ fontFamily: FONT, color: INK_4 }}>
            Recipient can scratch and claim without a wallet
          </p>

          <TxStatusBadge step="success" txHash={txHash} />

          <div className="flex gap-2.5">
            <PillBtn outline
              onClick={() => { reset(); setGiftUrl(null); setStep(1); setPhoto(null); setMessage(''); setShared(false) }}
              className="flex-1 py-3">
              Create another
            </PillBtn>
            {onDone && (
              <PillBtn onClick={onDone} className="flex-1 py-3">
                ← Dashboard
              </PillBtn>
            )}
          </div>
        </div>
      </motion.div>
    )
  }

  // ── Creation wizard ─────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-5" style={{ fontFamily: FONT }}>
      {/* Back + step progress */}
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="text-sm font-semibold shrink-0" style={{ color: INK_3 }}>
          ← Back
        </button>
        <div className="flex-1 flex items-center justify-center">
          {STEP_LABELS.map((label, i) => {
            const n = i + 1; const active = n === step; const done = n < step
            return (
              <div key={label} className="flex items-center">
                <div className="flex flex-col items-center gap-0.5">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all"
                    style={{
                      background: done || active ? INK : CANVAS,
                      color: done || active ? 'white' : INK_4,
                      border: `1.5px solid ${done || active ? INK : BORDER}`,
                    }}
                  >
                    {done ? '✓' : n}
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-wide"
                    style={{ color: active ? INK : INK_4 }}>
                    {label}
                  </span>
                </div>
                {i < STEP_LABELS.length - 1 && (
                  <div className="w-10 h-px mx-1 mb-4" style={{ background: done ? INK : BORDER }} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Step card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
          transition={{ type: 'spring', stiffness: 260, damping: 26 }}
          className="rounded-[28px] overflow-hidden"
          style={{ background: '#FFFFFF', border: `1px solid ${BORDER}`, boxShadow: '0 2px 20px rgba(0,0,0,0.04)' }}
        >
          {/* Step header — deep navy, same as hero card */}
          <div className="px-6 py-5" style={{ background: INK }}>
            <Micro style={{ color: 'rgba(255,255,255,0.35)' }}>Step {step} of 3</Micro>
            <h2 className="text-xl font-black text-white mt-1" style={{ letterSpacing: '-0.02em' }}>
              {step === 1 && 'Choose Amount'}
              {step === 2 && 'Add a Surprise Photo'}
              {step === 3 && 'Write Your Message'}
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {step === 1 && `Balance: ${usdcBalance ? `${usdcBalance} USDC` : '…'} · from ${displayName}`}
              {step === 2 && 'Optional — hidden under the scratch foil'}
              {step === 3 && 'Personal note revealed when scratched'}
            </p>
          </div>

          <div className="p-6 flex flex-col gap-5">

            {/* ── Step 1: Amount ── */}
            {step === 1 && (
              <>
                <div className="grid grid-cols-4 gap-2">
                  {AMOUNT_PILLS.map((a) => (
                    <motion.button key={a}
                      onClick={() => { setAmount(a); setCustomAmount('') }}
                      whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                      className="py-3 rounded-2xl text-sm font-bold transition-all"
                      style={{
                        background: amount === a ? INK : '#F8FAFC',
                        color: amount === a ? 'white' : INK_2,
                        border: `1.5px solid ${amount === a ? INK : BORDER}`,
                      }}
                    >
                      ${a}
                    </motion.button>
                  ))}
                </div>
                <div>
                  <button onClick={() => setAmount('custom')}
                    className="text-xs font-semibold mb-2 underline" style={{ color: INK_3 }}>
                    Or enter custom amount
                  </button>
                  {amount === 'custom' && (
                    <div className="flex items-center gap-2 rounded-2xl px-4 py-3"
                      style={{ border: `1.5px solid ${INK}`, background: CANVAS }}>
                      <span className="text-xl font-bold" style={{ color: INK_3 }}>$</span>
                      <input
                        type="number" min="0.01" step="0.01"
                        value={customAmount} onChange={(e) => setCustomAmount(e.target.value)}
                        placeholder="0.00"
                        className="flex-1 bg-transparent text-2xl font-black outline-none"
                        style={{ color: INK }}
                      />
                      <span className="text-sm font-semibold" style={{ color: INK_3 }}>USDC</span>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ── Step 2: Photo ── */}
            {step === 2 && (
              <>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) void handlePhotoUpload(f) }} />
                {photo ? (
                  <div className="flex flex-col gap-3">
                    <img src={photo} alt="Gift" className="w-full rounded-2xl object-cover" style={{ maxHeight: 220 }} />
                    <button onClick={() => setPhoto(null)}
                      className="text-xs font-semibold text-red-500 underline text-center">
                      Remove photo
                    </button>
                  </div>
                ) : (
                  <motion.button onClick={() => fileInputRef.current?.click()}
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    className="rounded-2xl p-10 flex flex-col items-center gap-3"
                    style={{ border: `2px dashed ${BORDER}`, background: CANVAS }}>
                    <span style={{ fontSize: 44 }}>📸</span>
                    <span className="text-sm font-bold" style={{ color: INK_3 }}>Tap to upload photo</span>
                    <span className="text-xs" style={{ color: INK_4 }}>JPEG or PNG · max 5 MB</span>
                  </motion.button>
                )}
              </>
            )}

            {/* ── Step 3: Message ── */}
            {step === 3 && (
              <>
                <textarea
                  value={message} onChange={(e) => setMessage(e.target.value)}
                  maxLength={280} rows={4}
                  placeholder="Happy birthday! 🎂 Enjoy a little something special from me..."
                  className="w-full rounded-2xl px-4 py-3 text-sm outline-none resize-none"
                  style={{ color: INK, border: `1.5px solid ${BORDER}`, background: CANVAS }}
                />
                <div className="flex items-center justify-between">
                  <div className="flex flex-wrap gap-1">
                    {['🎂','🎉','☕','💕','🥳','✨','🙌'].map((em) => (
                      <button key={em} onClick={() => setMessage((m) => m + em)}
                        className="text-xl p-1 hover:scale-125 transition-transform">
                        {em}
                      </button>
                    ))}
                  </div>
                  <span className="text-[10px]" style={{ color: INK_4 }}>{message.length}/280</span>
                </div>
                <TxStatusBadge step={txStep} errorMsg={errorMsg} txHash={txHash} />
              </>
            )}

            {/* Nav */}
            <div className="flex gap-3 mt-1">
              {step > 1 && (
                <PillBtn outline onClick={() => setStep((s) => s - 1)} className="flex-1 py-3">
                  ← Back
                </PillBtn>
              )}
              {step < 3 ? (
                <PillBtn onClick={() => setStep((s) => s + 1)}
                  disabled={step === 1 && !finalAmount}
                  className="flex-1 py-3">
                  Next →
                </PillBtn>
              ) : (
                <PillBtn
                  onClick={() => void handleSubmit()}
                  disabled={txStep === 'sending' || txStep === 'confirming' || !finalAmount}
                  className="flex-1 py-3.5 text-base">
                  {txStep === 'sending' ? 'Sending…' : txStep === 'confirming' ? 'Confirming…' : 'Create Gift'}
                </PillBtn>
              )}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
