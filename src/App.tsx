import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePrivy } from '@privy-io/react-auth'
import Layout from '@/components/Layout'
import LandingHero from '@/components/LandingHero'
import GiftCreator from '@/components/GiftCreator'
import Dashboard from '@/components/Dashboard'
import ScratchCard from '@/components/ScratchCard'
import ClaimCard from '@/components/ClaimCard'
import MascotSVG from '@/components/MascotSVG'
import { parseSecretKeyFromHash, computeCommitment, secretKeyToHex } from '@/lib/giftCrypto'
import { decodeGiftPayload, retrievePhoto } from '@/lib/imageStore'
import { useGiftBalance } from '@/hooks/useGiftBalance'

// Route states
type Route = 'landing' | 'create' | 'gift' | 'dashboard'

interface GiftState {
  secretKey: Uint8Array
  message: string
  photoDataUri: string | null
}

const pageVariants = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 200, damping: 24 } },
  exit: { opacity: 0, y: -24, transition: { duration: 0.18 } },
}

// Claim view: reads gift data + scratch reveal
function GiftView({ secretKey, message, photoDataUri }: GiftState) {
  const [scratched, setScratched] = useState(false)
  const [claimed, setClaimed]     = useState(false)

  // Bearer commitment — no recipient binding
  const commitment = computeCommitment(secretKey)

  // Try to retrieve sender's photo from sessionStorage (same device only)
  const storedPhoto = retrievePhoto(secretKeyToHex(secretKey))
  const displayPhoto = storedPhoto ?? photoDataUri

  const { amountUsdc, claimed: alreadyClaimed, exists } = useGiftBalance(commitment)

  return (
    <div className="py-6 flex flex-col gap-6">
      {/* Header */}
      <div className="text-center">
        <MascotSVG size={80} animate expression="excited" festive />
        <h1 className="font-display text-4xl text-navy mt-3">Someone sent you a gift!</h1>
        <p className="font-body text-sm text-navy/55 mt-1 font-600">Scratch the foil below to reveal your surprise</p>
      </div>

      {alreadyClaimed && !claimed ? (
        <div
          className="rounded-2xl px-5 py-4 text-center font-body font-800 text-sm"
          style={{ background: '#FFF1F2', border: '2.5px solid #F87171', color: '#DC2626' }}
        >
          This gift has already been claimed.
        </div>
      ) : !exists && commitment ? (
        <div
          className="rounded-2xl px-5 py-4 text-center font-body font-800 text-sm"
          style={{ background: '#FFF7ED', border: '2.5px solid #FB923C', color: '#C2410C' }}
        >
          Gift not found onchain — connect your wallet to check, or the link may be incorrect.
        </div>
      ) : null}

      {/* Scratch card */}
      {!claimed && (
        <ScratchCard
          photoDataUri={displayPhoto}
          message={message}
          amountUsdc={amountUsdc}
          onFullyRevealed={() => setScratched(true)}
        />
      )}

      {/* Claim button — only after reveal */}
      <AnimatePresence>
        {scratched && !claimed && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 220, damping: 22 }}
          >
            <ClaimCard
              secretKey={secretKey}
              amountUsdc={amountUsdc}
              onSuccess={() => setClaimed(true)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function App() {
  const { ready, authenticated } = usePrivy()
  const [route, setRoute] = useState<Route>('landing')
  const [giftPreset, setGiftPreset] = useState<{ amount: string; label: string } | undefined>()
  const [giftState, setGiftState] = useState<GiftState | null>(null)

  // Auth routing: signed-in → dashboard; signed-out → landing
  useEffect(() => {
    if (!ready) return
    const hasGift = window.location.hash.length > 1
    if (authenticated && route === 'landing' && !hasGift) {
      setRoute('dashboard')
    }
    if (!authenticated && (route === 'dashboard' || route === 'create')) {
      setRoute('landing')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, authenticated])

  // Parse gift key from URL hash on mount and on hash change
  useEffect(() => {
    function parseHash() {
      const hash = window.location.hash.replace(/^#/, '')
      if (!hash) return
      const payload = decodeGiftPayload(hash)
      if (!payload) return
      const secretKey = parseSecretKeyFromHash(`#${hash}`)
      if (!secretKey) return
      setGiftState({
        secretKey,
        message: payload.message,
        photoDataUri: payload.photoDataUri,
      })
      setRoute('gift')
    }
    parseHash()
    window.addEventListener('hashchange', parseHash)
    return () => window.removeEventListener('hashchange', parseHash)
  }, [])

  function handleCreateGift(preset?: { amount: string; label: string }) {
    setGiftPreset(preset)
    setRoute('create')
  }

  function handleClaimGift() {
    // Prompt user to paste a gift link
    const url = window.prompt('Paste your gift link here:')
    if (!url) return
    const hash = url.includes('#') ? url.split('#')[1] : null
    if (!hash) return
    const payload = decodeGiftPayload(hash)
    const secretKey = parseSecretKeyFromHash(`#${hash}`)
    if (!payload || !secretKey) {
      window.alert('Invalid gift link. Please check the link and try again.')
      return
    }
    setGiftState({ secretKey, message: payload.message, photoDataUri: payload.photoDataUri })
    setRoute('gift')
  }

  function handleLogoClick() {
    setRoute('landing')
    setGiftState(null)
    window.history.replaceState(null, '', window.location.pathname)
  }

  if (!ready) {
    return (
      <div className="min-h-dvh flex items-center justify-center" style={{ background: 'linear-gradient(180deg,#1E90D6 0%,#4FC3F7 30%,#B3E5FC 70%,#FFF8F0 100%)' }}>
        <motion.div
          animate={{ y: [0, -12, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        >
          <MascotSVG size={96} animate={false} expression="happy" festive />
        </motion.div>
      </div>
    )
  }

  // Dashboard owns its own full-page layout (bento, no sky background)
  // GiftCreator is embedded inside Dashboard — no external 'create' route needed when authenticated
  if (route === 'dashboard') {
    return (
      <AnimatePresence mode="wait">
        <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}>
          <Dashboard onBack={() => setRoute('landing')} />
        </motion.div>
      </AnimatePresence>
    )
  }

  return (
    <Layout onLogoClick={handleLogoClick}>
      <AnimatePresence mode="wait">
        {route === 'landing' && (
          <motion.div key="landing" {...pageVariants}>
            <LandingHero
              onCreateGift={handleCreateGift}
              onClaimGift={handleClaimGift}
              onDashboard={() => setRoute('dashboard')}
            />
          </motion.div>
        )}

        {route === 'create' && (
          <motion.div key="create" {...pageVariants}>
            <GiftCreator
              preset={giftPreset}
              onBack={() => setRoute('landing')}
            />
          </motion.div>
        )}

        {route === 'gift' && giftState && (
          <motion.div key="gift" {...pageVariants}>
            <GiftView {...giftState} />
          </motion.div>
        )}

        {route === 'gift' && !giftState && (
          <motion.div key="gift-empty" {...pageVariants}>
            <div className="py-20 text-center flex flex-col items-center gap-4">
              <MascotSVG size={80} animate expression="thinking" />
              <p className="font-display text-2xl text-navy">No gift found</p>
              <p className="font-body text-sm text-navy/55">The link may be expired or incorrect.</p>
              <button
                onClick={() => setRoute('landing')}
                className="btn-press font-display text-lg px-6 py-3 rounded-2xl text-white mt-2"
                style={{ background: 'linear-gradient(135deg,#A78BFA,#818CF8)', boxShadow: '0 5px 0 0 #4F46E5' }}
              >
                Back to Home
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Layout>
  )
}
