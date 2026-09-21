import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePrivy } from '@privy-io/react-auth'
import MascotSVG from './MascotSVG'
import HowItWorks from './HowItWorks'

const OCCASIONS = [
  { emoji: '🎂', label: 'Birthday',         amount: '5.00',  color: '#F87171', border: '#F87171', shadow: '#DC2626', bg: 'linear-gradient(135deg,#FFF1F2,#FFE4E6)' },
  { emoji: '☕', label: 'Coffee Treat',     amount: '1.00',  color: '#F97316', border: '#FB923C', shadow: '#EA580C', bg: 'linear-gradient(135deg,#FFF7ED,#FFEDD5)' },
  { emoji: '🎉', label: 'Congratulations', amount: '10.00', color: '#A78BFA', border: '#A78BFA', shadow: '#7C3AED', bg: 'linear-gradient(135deg,#F5F3FF,#EDE9FE)' },
  { emoji: '🎁', label: 'Custom Surprise', amount: null,    color: '#34D399', border: '#34D399', shadow: '#059669', bg: 'linear-gradient(135deg,#ECFDF5,#D1FAE5)' },
]

const MESSAGES = [
  { emoji: '🎂', title: 'Send a Birthday surprise',    sub: '$5 USDC wrapped in scratch-off foil',       color: '#F87171', glow: '#FCA5A5' },
  { emoji: '☕', title: 'Buy someone a coffee',        sub: '$1 USDC delivered as a magic scratch card',  color: '#F97316', glow: '#FED7AA' },
  { emoji: '🎉', title: 'Celebrate a big win',         sub: '$10 USDC — scratch to reveal the cheer',    color: '#A78BFA', glow: '#DDD6FE' },
  { emoji: '🎁', title: 'Send any amount, your way',   sub: 'You set the amount, they get the surprise',  color: '#34D399', glow: '#A7F3D0' },
  { emoji: '💌', title: 'A note + photo + real money', sub: 'Hide a personal message under the foil',    color: '#F472B6', glow: '#FBCFE8' },
  { emoji: '⚡', title: 'Claimed in under a second',   sub: 'Sub-second finality on Arc Testnet',         color: '#38BDF8', glow: '#BAE6FD' },
]

interface Props {
  onCreateGift: (preset?: { amount: string; label: string }) => void
  onClaimGift: () => void
  onDashboard: () => void
}

export default function LandingHero({ onCreateGift, onClaimGift, onDashboard }: Props) {
  const { authenticated, login } = usePrivy()
  const [msgIdx, setMsgIdx] = useState(0)

  // Auto-cycle messages every 2.8 s (visitors only)
  useEffect(() => {
    if (authenticated) return
    const t = setInterval(() => setMsgIdx((i) => (i + 1) % MESSAGES.length), 2800)
    return () => clearInterval(t)
  }, [authenticated])

  const msg = MESSAGES[msgIdx]

  return (
    <div className="flex flex-col gap-10 pb-4">

      {/* ── Hero ── */}
      <div className="text-center pt-6 flex flex-col items-center gap-6">
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 240, damping: 20 }}
        >
          <MascotSVG size={120} animate expression="excited" festive />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, type: 'spring', stiffness: 200, damping: 22 }}
          className="flex flex-col items-center gap-3"
        >
          <h1 className="font-display text-5xl md:text-6xl text-navy leading-none" style={{ letterSpacing: '-0.03em' }}>
            Send Magical
          </h1>
          <h1 className="font-display text-5xl md:text-6xl leading-none" style={{ letterSpacing: '-0.03em', color: '#A78BFA' }}>
            USDC Gift Cards
          </h1>
          <p className="font-body text-base text-navy/60 max-w-sm leading-relaxed font-600 mt-1">
            Hide a surprise photo + message under a scratch-off foil. Recipient scratches and claims the USDC instantly on Arc.
          </p>
        </motion.div>

        {/* ── Visitor: animated occasion message carousel ── */}
        {!authenticated && (
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.32, type: 'spring', stiffness: 180, damping: 22 }}
            className="w-full max-w-sm flex flex-col items-center gap-3"
          >
            {/* Carousel card */}
            <div
              className="w-full relative rounded-3xl overflow-hidden"
              style={{
                border: `3px solid ${msg.glow}`,
                boxShadow: `0 6px 0 0 ${msg.color}55, 0 0 40px 0 ${msg.glow}55`,
                transition: 'border-color 0.4s, box-shadow 0.4s',
              }}
            >
              {/* Radial glow bg */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{ background: `radial-gradient(ellipse at 50% 0%, ${msg.glow}55 0%, transparent 65%)`, transition: 'background 0.4s' }}
              />

              <AnimatePresence mode="wait">
                <motion.div
                  key={msgIdx}
                  initial={{ opacity: 0, y: 22, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -22, scale: 0.95 }}
                  transition={{ type: 'spring', stiffness: 280, damping: 26 }}
                  className="relative px-6 py-6 flex flex-col items-center gap-2 text-center"
                >
                  <motion.span
                    style={{ fontSize: 52, lineHeight: 1, display: 'block' }}
                    animate={{ rotate: [0, -10, 8, -4, 0], scale: [1, 1.18, 1.06, 1.12, 1] }}
                    transition={{ duration: 0.55, delay: 0.05 }}
                  >
                    {msg.emoji}
                  </motion.span>
                  <span className="font-display text-2xl text-navy mt-1 leading-tight">{msg.title}</span>
                  <span className="font-body text-sm font-700" style={{ color: msg.color }}>{msg.sub}</span>
                </motion.div>
              </AnimatePresence>

              {/* Dot indicators */}
              <div className="flex justify-center gap-1.5 pb-4">
                {MESSAGES.map((_, i) => (
                  <motion.button
                    key={i}
                    onClick={() => setMsgIdx(i)}
                    animate={{ width: i === msgIdx ? 20 : 7, background: i === msgIdx ? msg.color : `${msg.color}44` }}
                    transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                    className="h-2 rounded-full"
                    style={{ minWidth: 7 }}
                    aria-label={`Go to message ${i + 1}`}
                  />
                ))}
              </div>
            </div>

            {/* Pulsing sign-in nudge */}
            <motion.p
              animate={{ opacity: [0.45, 1, 0.45] }}
              transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
              className="font-body text-xs font-700 text-center"
              style={{ color: '#A78BFA' }}
            >
              ✨ Sign in to create your first scratch gift
            </motion.p>
          </motion.div>
        )}

        {/* ── CTAs ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: authenticated ? 0.12 : 0.44, type: 'spring', stiffness: 200, damping: 22 }}
          className="flex flex-col sm:flex-row gap-3 w-full max-w-sm"
        >
          {authenticated ? (
            <>
              <motion.button
                onClick={() => onCreateGift()}
                whileHover={{ scale: 1.04, y: -2 }}
                whileTap={{ scale: 0.97, y: 3 }}
                className="btn-press flex-1 font-display text-xl py-4 rounded-2xl text-white flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg,#A78BFA,#818CF8)', boxShadow: '0 6px 0 0 #4F46E5' }}
              >
                🎁 Create a Scratch Gift
              </motion.button>
              <motion.button
                onClick={onDashboard}
                whileHover={{ scale: 1.04, y: -2 }}
                whileTap={{ scale: 0.97, y: 3 }}
                className="btn-press font-display text-xl py-4 px-5 rounded-2xl text-white flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg,#34D399,#10B981)', boxShadow: '0 5px 0 0 #059669' }}
              >
                📊 Dashboard
              </motion.button>
            </>
          ) : (
            <motion.button
              onClick={() => void login()}
              whileHover={{ scale: 1.04, y: -2 }}
              whileTap={{ scale: 0.97, y: 3 }}
              className="btn-press w-full font-display text-xl py-4 rounded-2xl text-white flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg,#A78BFA,#818CF8)', boxShadow: '0 6px 0 0 #4F46E5' }}
            >
              ✨ Sign In to Send a Gift
            </motion.button>
          )}
        </motion.div>

        {/* Sub-feature pills */}
        <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
          {['⚡ Sub-second on Arc', '💸 USDC native gas', '🔐 No wallet needed to open'].map((t) => (
            <span key={t} className="font-body text-xs font-800 rounded-xl px-3 py-1.5" style={{ background: 'rgba(167,139,250,0.12)', color: '#6D28D9' }}>{t}</span>
          ))}
        </div>

        {/* Discreet claim link — visitors only */}
        {!authenticated && (
          <button
            onClick={onClaimGift}
            className="font-body text-xs font-700 underline underline-offset-2 transition-opacity hover:opacity-70"
            style={{ color: '#38BDF8' }}
          >
            🔍 Have a gift link? Tap here to claim
          </button>
        )}
      </div>

      {/* ── Occasion preset cards (signed-in only) ── */}
      {authenticated && (
        <div>
          <h2 className="font-display text-3xl text-navy text-center mb-5">Choose an Occasion</h2>
          <div className="grid grid-cols-2 gap-4">
            {OCCASIONS.map((o, i) => (
              <motion.button
                key={o.label}
                onClick={() => o.amount ? onCreateGift({ amount: o.amount, label: o.label }) : onCreateGift()}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 + i * 0.07, type: 'spring', stiffness: 200, damping: 22 }}
                whileHover={{ scale: 1.03, y: -3 }}
                whileTap={{ scale: 0.97, y: 3 }}
                className="rounded-3xl overflow-hidden text-left btn-press"
                style={{ background: o.bg, border: `3px solid ${o.border}`, boxShadow: `0 6px 0 0 ${o.shadow}` }}
              >
                <div
                  className="flex items-center justify-center py-5"
                  style={{ background: `linear-gradient(135deg, ${o.border}33, ${o.border}22)` }}
                >
                  <span style={{ fontSize: 44 }}>{o.emoji}</span>
                </div>
                <div className="p-4 flex flex-col gap-1">
                  <span className="font-display text-lg text-navy leading-tight">{o.label}</span>
                  <span className="font-body text-sm font-800" style={{ color: o.color }}>
                    {o.amount ? `$${o.amount} USDC` : 'You choose'}
                  </span>
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {/* ── How it works ── */}
      <HowItWorks />
    </div>
  )
}
