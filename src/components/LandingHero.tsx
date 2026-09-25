import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePrivy } from '@privy-io/react-auth'
import MascotSVG from './MascotSVG'
import HowItWorks from './HowItWorks'
import StatsBar from './StatsBar'
import UseCaseSection from './UseCaseSection'
import FaqSection from './FaqSection'
import FooterCard from './FooterCard'

// ── SVG icons ─────────────────────────────────────────────────────────────────
function IconZap() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  )
}
function IconDollar() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  )
}
function IconFingerprint() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12C2 6.5 6.5 2 12 2a10 10 0 0 1 8 4" />
      <path d="M5 19.5C5.5 18 6 15 6 12c0-3.3 2.7-6 6-6 1.8 0 3.4.8 4.5 2" />
      <path d="M11 22c.6-1.5 1-3.7 1-6 0-1.7 1.3-3 3-3s3 1.3 3 3c0 1.6-.2 3.2-.6 4.6" />
      <path d="M16 22c0-1.3.2-2.6.5-3.8" />
      <path d="M2 22c0-5.6 1-9 2-11" />
    </svg>
  )
}
function IconGift() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 12 20 22 4 22 4 12" />
      <rect x="2" y="7" width="20" height="5" />
      <line x1="12" y1="22" x2="12" y2="7" />
      <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
      <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
    </svg>
  )
}
function IconGrid() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
    </svg>
  )
}
function IconSparkle() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
    </svg>
  )
}

// ── Carousel messages — navy + sky accent only ────────────────────────────────
const MESSAGES = [
  { title: 'Send a Birthday surprise',    sub: '$5 USDC wrapped in scratch-off foil' },
  { title: 'Buy someone a coffee',        sub: '$1 USDC delivered as a scratch card' },
  { title: 'Celebrate a big win',         sub: '$10 USDC — scratch to reveal the cheer' },
  { title: 'Send any amount, your way',   sub: 'You set the amount, they get the surprise' },
  { title: 'A note + photo + real money', sub: 'Hide a personal message under the foil' },
  { title: 'Claimed in under a second',   sub: 'Sub-second finality on Arc Testnet' },
]

// ── Occasion cards — consistent navy/sky, no rainbow ─────────────────────────
const OCCASIONS = [
  { label: 'Birthday',         amount: '5.00'  },
  { label: 'Coffee Treat',     amount: '1.00'  },
  { label: 'Congratulations',  amount: '10.00' },
  { label: 'Custom Surprise',  amount: null    },
]

interface Props {
  onCreateGift: (preset?: { amount: string; label: string }) => void
  onClaimGift: () => void
  onDashboard: () => void
}

export default function LandingHero({ onCreateGift, onClaimGift, onDashboard }: Props) {
  const { authenticated, login } = usePrivy()
  const [msgIdx, setMsgIdx] = useState(0)

  useEffect(() => {
    if (authenticated) return
    const t = setInterval(() => setMsgIdx((i) => (i + 1) % MESSAGES.length), 2800)
    return () => clearInterval(t)
  }, [authenticated])

  const msg = MESSAGES[msgIdx]

  return (
    <div className="flex flex-col">

      {/* ══════════════════════════════════════════════════════
          HERO
      ══════════════════════════════════════════════════════ */}
      <section className="w-full px-6 md:px-16 lg:px-24 pt-12 pb-20">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-12 md:gap-16">

          {/* Left — text + CTAs */}
          <div className="flex-1 flex flex-col gap-6 text-center md:text-left items-center md:items-start">
            <motion.div
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 240, damping: 20 }}
            >
              <MascotSVG size={88} animate expression="excited" festive />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12, type: 'spring', stiffness: 200, damping: 22 }}
              className="flex flex-col gap-3 items-center md:items-start"
            >
              <h1
                className="font-display text-5xl md:text-6xl lg:text-7xl leading-none"
                style={{ letterSpacing: '-0.03em', color: '#0F172A' }}
              >
                Send Magical
              </h1>
              <h1
                className="font-display text-5xl md:text-6xl lg:text-7xl leading-none"
                style={{ letterSpacing: '-0.03em', color: '#38BDF8' }}
              >
                USDC Gift Cards
              </h1>
              <p
                className="font-body text-base md:text-lg leading-relaxed mt-1 max-w-md"
                style={{ color: 'rgba(15,23,42,0.55)' }}
              >
                Hide a surprise photo and message under a scratch-off foil. Recipient scratches and claims USDC instantly — no wallet setup required.
              </p>
            </motion.div>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: authenticated ? 0.12 : 0.36, type: 'spring', stiffness: 200, damping: 22 }}
              className="flex flex-col sm:flex-row gap-3 w-full max-w-sm md:max-w-none md:w-auto"
            >
              {authenticated ? (
                <>
                  <motion.button
                    onClick={() => onCreateGift()}
                    whileHover={{ scale: 1.04, y: -2 }}
                    whileTap={{ scale: 0.97, y: 2 }}
                    className="btn-press font-display text-lg py-4 px-8 rounded-2xl text-white flex items-center justify-center gap-2"
                    style={{ background: '#0F172A', boxShadow: '0 6px 0 0 rgba(15,23,42,0.35)' }}
                  >
                    <IconGift /> Create a Gift
                  </motion.button>
                  <motion.button
                    onClick={onDashboard}
                    whileHover={{ scale: 1.04, y: -2 }}
                    whileTap={{ scale: 0.97, y: 2 }}
                    className="btn-press font-display text-lg py-4 px-6 rounded-2xl flex items-center justify-center gap-2"
                    style={{ background: 'white', color: '#0F172A', border: '1.5px solid rgba(15,23,42,0.12)', boxShadow: '0 4px 0 0 rgba(15,23,42,0.08)' }}
                  >
                    <IconGrid /> Dashboard
                  </motion.button>
                </>
              ) : (
                <>
                  <motion.button
                    onClick={() => void login()}
                    whileHover={{ scale: 1.04, y: -2 }}
                    whileTap={{ scale: 0.97, y: 2 }}
                    className="btn-press font-display text-lg py-4 px-8 rounded-2xl text-white flex items-center justify-center gap-2"
                    style={{ background: '#0F172A', boxShadow: '0 6px 0 0 rgba(15,23,42,0.35)' }}
                  >
                    <IconSparkle /> Sign In to Send a Gift
                  </motion.button>
                  <motion.button
                    onClick={onClaimGift}
                    whileHover={{ scale: 1.04, y: -2 }}
                    whileTap={{ scale: 0.97, y: 2 }}
                    className="btn-press font-display text-lg py-4 px-6 rounded-2xl flex items-center justify-center gap-2"
                    style={{ background: 'white', color: '#0F172A', border: '1.5px solid rgba(15,23,42,0.12)', boxShadow: '0 4px 0 0 rgba(15,23,42,0.08)' }}
                  >
                    Claim a gift →
                  </motion.button>
                </>
              )}
            </motion.div>

            {/* Feature pills */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="flex flex-wrap items-center justify-center md:justify-start gap-2"
            >
              {[
                { Icon: IconZap,         label: 'Sub-second on Arc'       },
                { Icon: IconDollar,      label: 'USDC native gas'         },
                { Icon: IconFingerprint, label: 'No wallet needed to open' },
              ].map(({ Icon, label }) => (
                <span
                  key={label}
                  className="font-body text-xs font-700 rounded-xl px-3 py-1.5 flex items-center gap-1.5"
                  style={{ background: 'rgba(56,189,248,0.10)', color: '#0F172A' }}
                >
                  <span style={{ color: '#38BDF8' }}><Icon /></span>
                  {label}
                </span>
              ))}
            </motion.div>
          </div>

          {/* Right — carousel (visitors) / occasion grid (authed) */}
          <motion.div
            className="flex-1 w-full max-w-sm md:max-w-none"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 180, damping: 24 }}
          >
            {!authenticated ? (
              <div className="flex flex-col items-center gap-3">
                <div
                  className="w-full relative rounded-3xl overflow-hidden"
                  style={{
                    border: '1.5px solid rgba(56,189,248,0.3)',
                    boxShadow: '0 6px 0 0 rgba(56,189,248,0.15), 0 0 40px 0 rgba(56,189,248,0.10)',
                  }}
                >
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(56,189,248,0.12) 0%, transparent 65%)' }}
                  />
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={msgIdx}
                      initial={{ opacity: 0, y: 22, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -22, scale: 0.95 }}
                      transition={{ type: 'spring', stiffness: 280, damping: 26 }}
                      className="relative px-8 py-10 flex flex-col items-center gap-2 text-center"
                    >
                      {/* Icon — sky blue circle */}
                      <div
                        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-1"
                        style={{ background: 'rgba(56,189,248,0.12)' }}
                      >
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#38BDF8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 12 20 22 4 22 4 12" />
                          <rect x="2" y="7" width="20" height="5" />
                          <line x1="12" y1="22" x2="12" y2="7" />
                          <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
                          <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
                        </svg>
                      </div>
                      <span
                        className="font-display text-2xl md:text-3xl leading-tight"
                        style={{ color: '#0F172A' }}
                      >
                        {msg.title}
                      </span>
                      <span
                        className="font-body text-sm font-600"
                        style={{ color: '#38BDF8' }}
                      >
                        {msg.sub}
                      </span>
                    </motion.div>
                  </AnimatePresence>
                  {/* Dot indicators */}
                  <div className="flex justify-center gap-1.5 pb-5">
                    {MESSAGES.map((_, i) => (
                      <motion.button
                        key={i}
                        onClick={() => setMsgIdx(i)}
                        animate={{
                          width: i === msgIdx ? 20 : 7,
                          background: i === msgIdx ? '#38BDF8' : 'rgba(56,189,248,0.25)',
                        }}
                        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                        className="h-2 rounded-full"
                        style={{ minWidth: 7 }}
                        aria-label={`Go to message ${i + 1}`}
                      />
                    ))}
                  </div>
                </div>
                <motion.p
                  animate={{ opacity: [0.45, 1, 0.45] }}
                  transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
                  className="font-body text-xs font-700 text-center"
                  style={{ color: 'rgba(15,23,42,0.4)' }}
                >
                  Sign in to create your first scratch gift
                </motion.p>
              </div>
            ) : (
              /* Authenticated occasion grid — navy + sky */
              <div className="flex flex-col gap-4">
                <h2
                  className="font-display text-2xl text-center md:text-left"
                  style={{ color: '#0F172A' }}
                >
                  Choose an occasion
                </h2>
                <div className="grid grid-cols-2 gap-4">
                  {OCCASIONS.map((o, i) => (
                    <motion.button
                      key={o.label}
                      onClick={() => o.amount ? onCreateGift({ amount: o.amount, label: o.label }) : onCreateGift()}
                      initial={{ opacity: 0, y: 24 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.05 + i * 0.07, type: 'spring', stiffness: 200, damping: 22 }}
                      whileHover={{ scale: 1.03, y: -3 }}
                      whileTap={{ scale: 0.97, y: 2 }}
                      className="rounded-2xl overflow-hidden text-left btn-press"
                      style={{
                        background: '#F8FAFC',
                        border: '1.5px solid rgba(15,23,42,0.08)',
                        boxShadow: '0 4px 0 0 rgba(15,23,42,0.06)',
                      }}
                    >
                      {/* Top accent bar */}
                      <div className="h-1 w-full" style={{ background: '#38BDF8' }} />
                      <div className="p-4 flex flex-col gap-1.5">
                        <span
                          className="font-display text-base leading-tight"
                          style={{ color: '#0F172A' }}
                        >
                          {o.label}
                        </span>
                        <span
                          className="font-body text-sm font-700"
                          style={{ color: '#38BDF8' }}
                        >
                          {o.amount ? `$${o.amount} USDC` : 'You choose'}
                        </span>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </section>

      {/* Stats strip */}
      <StatsBar />

      {/* Use case rows */}
      <UseCaseSection
        onCreateGift={() => onCreateGift()}
        onSignIn={() => void login()}
      />

      {/* How It Works */}
      <HowItWorks />

      {/* FAQ */}
      <FaqSection />

      {/* Footer CTA */}
      <section
        className="w-full px-6 md:px-16 lg:px-24 py-24 flex flex-col items-center text-center gap-8"
        style={{ background: '#0F172A' }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ type: 'spring', stiffness: 180, damping: 22 }}
          className="flex flex-col items-center gap-5"
        >
          <h2
            className="font-display text-4xl md:text-6xl text-white leading-tight max-w-2xl"
            style={{ letterSpacing: '-0.03em' }}
          >
            Ready to send your first gift?
          </h2>
          <p
            className="font-body text-base max-w-md"
            style={{ color: 'rgba(255,255,255,0.5)' }}
          >
            It takes under a minute. No wallet setup for your recipient.
          </p>
          <motion.button
            onClick={authenticated ? () => onCreateGift() : () => void login()}
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.97 }}
            className="btn-press font-display text-lg px-10 py-4 rounded-2xl mt-2"
            style={{
              background: '#38BDF8',
              color: '#0F172A',
              boxShadow: '0 6px 0 0 rgba(56,189,248,0.35)',
            }}
          >
            {authenticated ? 'Create a Scratch Gift' : "Get Started — it's free"}
          </motion.button>
        </motion.div>
      </section>

      {/* Footer */}
      <FooterCard />

    </div>
  )
}
