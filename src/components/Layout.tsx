import { useState } from 'react'
import { usePrivy, useWallets } from '@privy-io/react-auth'
import { motion, AnimatePresence } from 'framer-motion'
import MascotSVG from './MascotSVG'
import FooterCard from './FooterCard'

interface LayoutProps {
  children: React.ReactNode
  onLogoClick?: () => void
}

// Pre-computed static cloud data — no Math.random() in render
const CLOUDS = [
  { id: 1, x: '-15%', y: '3%',  w: 260, dur: 55,  delay: 0,  opacity: 0.95 },
  { id: 2, x: '-25%', y: '11%', w: 200, dur: 72,  delay: 14, opacity: 0.85 },
  { id: 3, x: '70%',  y: '5%',  w: 320, dur: 95,  delay: 3,  opacity: 0.90 },
  { id: 4, x: '-40%', y: '19%', w: 150, dur: 85,  delay: 38, opacity: 0.80 },
  { id: 5, x: '40%',  y: '15%', w: 180, dur: 110, delay: 55, opacity: 0.75 },
]

const STARS = [
  { x: '7%',  y: '7%',  c: '#FBBF24', s: 14, dur: 2.2 },
  { x: '23%', y: '4%',  c: '#A78BFA', s: 10, dur: 3.4 },
  { x: '80%', y: '5%',  c: '#F87171', s: 16, dur: 2.0 },
  { x: '92%', y: '11%', c: '#34D399', s: 12, dur: 4.0 },
  { x: '51%', y: '2%',  c: '#38BDF8', s: 9,  dur: 2.8 },
  { x: '36%', y: '14%', c: '#FBBF24', s: 8,  dur: 4.3 },
  { x: '65%', y: '8%',  c: '#A78BFA', s: 11, dur: 2.5 },
  { x: '15%', y: '21%', c: '#F87171', s: 8,  dur: 3.6 },
  { x: '88%', y: '19%', c: '#34D399', s: 13, dur: 3.0 },
]

function PuffyCloud({ width }: { width: number }) {
  const h = Math.round(width * 0.58)
  return (
    <svg width={width} height={h} viewBox="0 0 200 116" fill="none">
      <ellipse cx="100" cy="88" rx="98"  ry="28" fill="white" />
      <ellipse cx="55"  cy="70" rx="44"  ry="40" fill="white" />
      <ellipse cx="135" cy="62" rx="52"  ry="46" fill="white" />
      <ellipse cx="92"  cy="52" rx="40"  ry="38" fill="white" />
      <ellipse cx="160" cy="80" rx="30"  ry="22" fill="white" />
    </svg>
  )
}

export default function Layout({ children, onLogoClick }: LayoutProps) {
  const { ready, authenticated, user, login, logout } = usePrivy()
  const { wallets } = useWallets()
  const [copied, setCopied] = useState(false)
  const [walletOpen, setWalletOpen] = useState(false)

  const displayName = (() => {
    if (!authenticated || !user) return null
    const email = user.email?.address
    if (email) return email.split('@')[0]
    const google = user.google?.name ?? user.google?.email?.split('@')[0]
    if (google) return google
    const addr = wallets.find((w) => w.walletClientType === 'privy')?.address ?? wallets[0]?.address
    if (addr) return `${addr.slice(0, 6)}…${addr.slice(-4)}`
    return 'You'
  })()

  // Always show the Privy embedded wallet address — same source of truth as useSubscription
  const embeddedWallet = wallets.find((w) => w.walletClientType === 'privy') ?? wallets[0]
  const walletAddress = embeddedWallet?.address ?? null
  const shortAddress = walletAddress ? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}` : null

  function copyAddress() {
    if (!walletAddress) return
    void navigator.clipboard.writeText(walletAddress).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div
      className="relative overflow-x-hidden"
      style={{
        minHeight: '100dvh',
        /* Tall gradient that repeats to fill any page length — no white gaps */
        background: `
          linear-gradient(180deg,
            #1E90D6 0%,
            #4FC3F7 8%,
            #81D4FA 18%,
            #B3E5FC 32%,
            #E1F5FE 50%,
            #FFF8F0 68%,
            #FFF3E0 78%,
            #FFF8F0 88%,
            #E1F5FE 100%
          )
        `,
        backgroundColor: '#E1F5FE',
      }}
    >
      {/* ── Sky scene (fixed, behind everything) ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">

        {/* Sun glow */}
        <div
          className="absolute"
          style={{
            top: '-80px', right: '8%',
            width: 220, height: 220,
            borderRadius: '50%',
            background: 'radial-gradient(circle, #FFF176 0%, #FFD54F 40%, rgba(255,213,79,0) 70%)',
            opacity: 0.9,
          }}
        />
        {/* Sun core */}
        <div
          className="absolute"
          style={{
            top: '-24px', right: '12%',
            width: 80, height: 80,
            borderRadius: '50%',
            background: '#FFD54F',
            boxShadow: '0 0 40px 20px #FFF176',
          }}
        />

        {/* Drifting clouds */}
        {CLOUDS.map((c) => (
          <motion.div
            key={c.id}
            className="absolute pointer-events-none"
            style={{ left: c.x, top: c.y, opacity: c.opacity }}
            animate={{ x: ['0vw', '130vw'] }}
            transition={{ duration: c.dur, repeat: Infinity, ease: 'linear', delay: c.delay }}
          >
            <PuffyCloud width={c.w} />
          </motion.div>
        ))}

        {/* Twinkling stars / dots */}
        {STARS.map((s) => (
          <motion.div
            key={`${s.x}-${s.y}`}
            className="absolute pointer-events-none rounded-full"
            style={{ left: s.x, top: s.y, width: s.s, height: s.s, background: s.c, boxShadow: `0 0 ${s.s * 2}px ${s.c}` }}
            animate={{ scale: [1, 1.6, 1], opacity: [0.75, 1, 0.75] }}
            transition={{ duration: s.dur, repeat: Infinity, ease: 'easeInOut' }}
          />
        ))}

        {/* Ground hills — solid colors */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 220" preserveAspectRatio="none" className="w-full" style={{ height: 140 }}>
            {/* Back hill — lavender */}
            <ellipse cx="300"  cy="220" rx="480" ry="150" fill="#C4B5FD" opacity="0.6" />
            {/* Mid hill — mint */}
            <ellipse cx="1050" cy="220" rx="560" ry="160" fill="#6EE7B7" opacity="0.65" />
            {/* Front hill — sunshine */}
            <ellipse cx="720"  cy="220" rx="700" ry="130" fill="#FDE68A" opacity="0.5" />
            {/* Far right — sky */}
            <ellipse cx="1380" cy="220" rx="320" ry="120" fill="#BAE6FD" opacity="0.55" />
          </svg>
        </div>

        {/* Warm ground strip */}
        <div className="absolute bottom-0 left-0 right-0 h-16" style={{ background: 'linear-gradient(0deg, rgba(251,191,36,0.25) 0%, transparent 100%)' }} />
      </div>

      {/* ── Navbar ── */}
      <nav className="relative z-50 px-4 pt-4 pb-2 max-w-3xl mx-auto">
        <div
          className="flex items-center justify-between rounded-3xl px-5 py-3"
          style={{
            background: 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(16px)',
            border: '3px solid rgba(255,255,255,0.95)',
            boxShadow: '0 6px 0 0 rgba(15,23,42,0.10), 0 2px 20px -2px rgba(15,23,42,0.10)',
          }}
        >
          <button onClick={onLogoClick} className="flex items-center gap-3">
            <motion.div whileHover={{ rotate: [0, -14, 14, 0], scale: 1.12 }} transition={{ duration: 0.45 }}>
              <MascotSVG size={48} animate={false} expression="happy" festive />
            </motion.div>
            <div>
              <div className="font-display text-2xl text-navy leading-none" style={{ letterSpacing: '-0.01em' }}>Scratch & Split</div>
              <div className="font-body text-[9px] font-800 uppercase tracking-[0.2em] leading-none mt-0.5" style={{ color: '#7C3AED' }}>USDC Gift Cards on Arc</div>
            </div>
          </button>

          {/* Auth */}
          {!ready ? (
            <div className="w-24 h-10 rounded-2xl animate-pulse" style={{ background: '#E2E8F0' }} />
          ) : authenticated && displayName ? (
            <div className="relative flex items-center gap-2">
              {/* Avatar + name pill — tapping opens dropdown */}
              <motion.button
                onClick={() => setWalletOpen((v) => !v)}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="flex items-center gap-2 rounded-2xl px-3 py-2 border-2"
                style={{ background: '#E6FBF2', borderColor: '#34D399', boxShadow: '0 3px 0 0 #059669' }}
              >
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center font-display text-sm text-white flex-shrink-0"
                  style={{ background: '#34D399' }}
                >
                  {displayName[0].toUpperCase()}
                </div>
                <span className="font-body font-800 text-sm max-w-[80px] truncate hidden sm:block" style={{ color: '#059669' }}>{displayName}</span>
                <span className="font-body text-xs" style={{ color: '#059669' }}>▾</span>
              </motion.button>

              {/* Dropdown */}
              <AnimatePresence>
                {walletOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.95 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                    className="absolute top-full right-0 mt-2 z-50 rounded-3xl overflow-hidden"
                    style={{
                      minWidth: 260,
                      background: 'white',
                      border: '3px solid #E2E8F0',
                      boxShadow: '0 8px 0 0 rgba(15,23,42,0.10), 0 4px 24px -4px rgba(15,23,42,0.14)',
                    }}
                  >
                    {/* Header */}
                    <div className="px-4 pt-4 pb-3 border-b-2 border-slate-100">
                      <div className="font-body text-xs font-800 uppercase tracking-widest mb-1" style={{ color: '#94A3B8' }}>Signed in as</div>
                      <div className="font-display text-base text-navy truncate">{displayName}</div>
                    </div>

                    {/* Wallet address */}
                    {walletAddress ? (
                      <div className="px-4 py-3 border-b-2 border-slate-100">
                        <div className="font-body text-xs font-800 uppercase tracking-widest mb-2" style={{ color: '#94A3B8' }}>Your Wallet</div>
                        <div
                          className="rounded-2xl px-3 py-2.5 font-body text-sm font-700 text-navy/70 break-all mb-2"
                          style={{ background: '#F8FAFC', border: '2px solid #E2E8F0' }}
                        >
                          {walletAddress}
                        </div>
                        <motion.button
                          onClick={copyAddress}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.97 }}
                          className="btn-press w-full font-display text-base py-2.5 rounded-2xl text-white flex items-center justify-center gap-2"
                          style={{
                            background: copied ? '#34D399' : '#A78BFA',
                            boxShadow: copied ? '0 4px 0 0 #059669' : '0 4px 0 0 #7C3AED',
                          }}
                        >
                          {copied ? '✓ Copied!' : '📋 Copy Address'}
                        </motion.button>
                        <p className="font-body text-xs text-navy/40 text-center mt-2">
                          Send USDC to this address to top up
                        </p>
                      </div>
                    ) : (
                      <div className="px-4 py-3 border-b-2 border-slate-100">
                        <div className="font-body text-xs font-700 text-navy/50 text-center py-1">No wallet connected yet</div>
                      </div>
                    )}

                    {/* Short address chip + sign out */}
                    <div className="px-4 py-3 flex items-center justify-between">
                      {shortAddress && (
                        <div className="font-body text-xs font-800 rounded-xl px-2 py-1" style={{ background: '#F0EEFF', color: '#7C3AED' }}>
                          {shortAddress}
                        </div>
                      )}
                      <motion.button
                        onClick={() => { setWalletOpen(false); void logout() }}
                        whileHover={{ scale: 1.04 }}
                        whileTap={{ scale: 0.96 }}
                        className="btn-press font-body font-800 text-xs px-4 py-2 rounded-2xl ml-auto"
                        style={{ background: '#FFF0F0', color: '#DC2626', boxShadow: '0 3px 0 0 #FECACA' }}
                      >
                        Sign out
                      </motion.button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Click-outside overlay */}
              {walletOpen && (
                <div className="fixed inset-0 z-40" onClick={() => setWalletOpen(false)} />
              )}
            </div>
          ) : (
            <motion.button
              onClick={() => void login()}
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.96, y: 2 }}
              className="btn-press font-display text-base px-5 py-2.5 rounded-2xl text-white"
              style={{ background: '#FBBF24', boxShadow: '0 4px 0 0 #D97706', color: '#0F172A' }}
            >
              Sign In ✨
            </motion.button>
          )}
        </div>
      </nav>

      {/* ── Page content ── */}
      <main className="relative z-10 max-w-3xl mx-auto px-4 pb-10">
        {children}
      </main>

      {/* ── Footer card ── */}
      <div className="relative z-10 max-w-3xl mx-auto px-4 pb-8">
        <FooterCard />
      </div>
    </div>
  )
}
