/**
 * AddFundsModal
 *
 * Embeds the Circle Onramp Kit widget in a modal overlay.
 * Uses the real @circle-fin/onramp-kit browser API.
 */

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type {
  OnrampWidget,
  OnrampInitializationErrorEnvelope,
  OnrampDepositSubmittedEnvelope,
  OnrampDepositSettledEnvelope,
  OnrampDepositNotCompletedEnvelope,
} from '@circle-fin/onramp-kit'
import { parseOnrampSession } from '@circle-fin/onramp-kit/server'

// ── Design tokens ─────────────────────────────────────────────────────────────
const INK    = '#111827'
const INK_3  = '#6B7280'
const INK_4  = '#9CA3AF'
const BORDER = 'rgba(0,0,0,0.06)'
const SURF   = '#FFFFFF'
const CANVAS = '#F5F5F7'

// ── Types ─────────────────────────────────────────────────────────────────────
type Step =
  | 'idle'
  | 'fetching'
  | 'loading'
  | 'ready'
  | 'submitted'
  | 'settled'
  | 'error'

interface Props {
  walletAddress: string
  userId: string
  onClose: () => void
  onSettled?: () => void
}

export default function AddFundsModal({ walletAddress, userId, onClose, onSettled }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetRef    = useRef<OnrampWidget | null>(null)
  const [step, setStep]           = useState<Step>('idle')
  const [errorMsg, setErrorMsg]   = useState<string | null>(null)
  const [submittedAmt, setSubmittedAmt] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function mount() {
      setStep('fetching')
      setErrorMsg(null)

      try {
        // 1. Fetch session from our server endpoint
        const res = await fetch('/api/onramp/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            appUserId: userId,
            destinationAddress: walletAddress,
            destinationChain: 'Arc_Testnet',
            currency: 'USD',
            assets: { tokens: ['USDC'] },
          }),
        })

        const raw = await res.json() as unknown

        if (!res.ok) {
          const err = raw as { error?: string; detail?: string }
          throw new Error(err.error ?? `Server error ${res.status}`)
        }

        if (cancelled) return

        // 2. Parse the session — handles { data: session } envelope automatically
        const session = parseOnrampSession(raw)

        // 3. Import the browser kit dynamically
        const { createOnrampKit } = await import('@circle-fin/onramp-kit')

        if (cancelled || !containerRef.current) return

        setStep('loading')

        const kit = createOnrampKit()

        const widget = kit.mountIframe({
          session,
          container: containerRef.current,

          onInitializationSuccess: () => {
            if (!cancelled) setStep('ready')
          },

          onInitializationError: (e: OnrampInitializationErrorEnvelope) => {
            if (!cancelled) {
              if (e.code === 'INVALID_SESSION_TOKEN') {
                void mount() // re-mint
              } else {
                setStep('error')
                setErrorMsg(
                  (e.payload as { errorMessage?: string }).errorMessage
                  ?? 'Widget failed to load'
                )
              }
            }
          },

          onDepositSubmitted: (e: OnrampDepositSubmittedEnvelope) => {
            if (!cancelled) {
              setStep('submitted')
              const amt = e.payload.amount
              setSubmittedAmt(amt != null ? String(amt) : null)
            }
          },

          onDepositSettled: (_e: OnrampDepositSettledEnvelope) => {
            if (!cancelled) {
              setStep('settled')
              onSettled?.()
            }
          },

          onDepositNotCompleted: (e: OnrampDepositNotCompletedEnvelope) => {
            if (!cancelled) {
              if (e.code === 'CANCELED_BY_CUSTOMER') {
                onClose()
              } else if (e.code === 'SESSION_TIMEOUT') {
                void mount()
              } else {
                setStep('error')
                setErrorMsg(`Deposit not completed (${e.code})`)
              }
            }
          },

          onSessionExpired: () => {
            if (!cancelled) void mount()
          },
        })

        widgetRef.current = widget

      } catch (err) {
        if (!cancelled) {
          setStep('error')
          setErrorMsg(err instanceof Error ? err.message : 'Something went wrong')
        }
      }
    }

    void mount()

    return () => {
      cancelled = true
      widgetRef.current?.close()
      widgetRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletAddress, userId])

  // ── Status overlays ───────────────────────────────────────────────────────
  function StatusOverlay() {
    if (step === 'error') {
      return (
        <div className="flex flex-col items-center gap-4 py-12 px-6 text-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ background: '#FEF2F2' }}>
            <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="#EF4444"
              strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <div>
            <p className="text-base font-bold" style={{ color: INK }}>Something went wrong</p>
            {errorMsg && <p className="text-xs mt-1" style={{ color: INK_3 }}>{errorMsg}</p>}
          </div>
          <button
            onClick={() => { setStep('idle'); setErrorMsg(null); widgetRef.current?.close(); widgetRef.current = null }}
            className="w-full py-3 rounded-2xl text-sm font-bold"
            style={{ background: INK, color: SURF }}>
            Try again
          </button>
        </div>
      )
    }

    if (step === 'settled') {
      return (
        <div className="flex flex-col items-center gap-4 py-12 px-6 text-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ background: '#F0FDF4' }}>
            <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="#16A34A"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          </div>
          <div>
            <p className="text-base font-bold" style={{ color: INK }}>USDC arrived!</p>
            <p className="text-sm mt-1" style={{ color: INK_3 }}>Your balance will update momentarily.</p>
          </div>
          <button onClick={onClose} className="w-full py-3 rounded-2xl text-sm font-bold"
            style={{ background: INK, color: SURF }}>
            Done
          </button>
        </div>
      )
    }

    if (step === 'submitted') {
      return (
        <div className="flex flex-col items-center gap-4 py-12 px-6 text-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center animate-pulse"
            style={{ background: '#EFF6FF' }}>
            <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="#1D4ED8"
              strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div>
            <p className="text-base font-bold" style={{ color: INK }}>Deposit submitted</p>
            <p className="text-sm mt-1" style={{ color: INK_3 }}>
              {submittedAmt ? `$${submittedAmt} USDC` : 'Funds'} are on their way…
            </p>
          </div>
        </div>
      )
    }

    if (step === 'fetching' || step === 'loading' || step === 'idle') {
      return (
        <div className="flex flex-col items-center gap-3 py-16 px-6 text-center">
          <div className="w-10 h-10 rounded-full border-2 border-neutral-200 border-t-neutral-800 animate-spin" />
          <p className="text-sm font-medium" style={{ color: INK_3 }}>
            {step === 'fetching' ? 'Preparing secure session…' : 'Loading payment widget…'}
          </p>
        </div>
      )
    }

    return null
  }

  const showContainer = step === 'ready' || step === 'submitted'

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

        <motion.div
          className="relative w-full sm:max-w-md mx-auto rounded-t-[28px] sm:rounded-[28px] overflow-hidden shadow-2xl z-10"
          style={{ background: SURF, maxHeight: '92dvh' }}
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 40, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 32 }}
        >
          {/* Handle */}
          <div className="sm:hidden flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full" style={{ background: '#E5E7EB' }} />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: BORDER }}>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: INK_4 }}>Add Funds</p>
              <h2 className="text-base font-bold leading-tight mt-0.5" style={{ color: INK }}>
                Buy USDC with card
              </h2>
            </div>
            <button onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:bg-neutral-100"
              style={{ color: INK_3 }}>
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Widget iframe container */}
          <div
            ref={containerRef}
            style={{
              height: showContainer ? 560 : 0,
              overflow: 'hidden',
              visibility: showContainer ? 'visible' : 'hidden',
              // Required CSP: frame-src https://onramp.arc.io
              background: CANVAS,
            }}
          />

          {/* Status overlays */}
          {!showContainer && <StatusOverlay />}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
