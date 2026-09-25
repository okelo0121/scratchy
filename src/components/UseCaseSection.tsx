import { motion } from 'framer-motion'
import { usePrivy } from '@privy-io/react-auth'

interface Props {
  onCreateGift: () => void
  onSignIn: () => void
}

// ── Inline SVG mockups — navy + sky palette only ──────────────────────────────

function ScratchCardMockup() {
  return (
    <svg viewBox="0 0 320 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full max-w-sm mx-auto drop-shadow-lg">
      {/* Card body */}
      <rect x="8" y="8" width="304" height="184" rx="20" fill="white" stroke="rgba(15,23,42,0.08)" strokeWidth="1.5" />
      {/* Foil area — navy tint */}
      <rect x="24" y="28" width="272" height="112" rx="12" fill="#0F172A" opacity="0.06" />
      <rect x="24" y="28" width="272" height="112" rx="12" fill="url(#foilGrad)" />
      <defs>
        <linearGradient id="foilGrad" x1="24" y1="28" x2="296" y2="140" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#CBD5E1" stopOpacity="0.9" />
          <stop offset="40%"  stopColor="#E2E8F0" stopOpacity="0.95" />
          <stop offset="60%"  stopColor="#F1F5F9" stopOpacity="0.98" />
          <stop offset="100%" stopColor="#CBD5E1" stopOpacity="0.9" />
        </linearGradient>
      </defs>
      {/* Scratch lines */}
      {[40,54,68,82,96,110].map(y => (
        <line key={y} x1="30" y1={y} x2="290" y2={y} stroke="white" strokeWidth="1.5" strokeOpacity="0.45" />
      ))}
      {/* Scratched reveal corner */}
      <clipPath id="reveal">
        <path d="M24 28 Q90 26 120 62 Q90 110 24 140 Z" />
      </clipPath>
      <rect x="24" y="28" width="272" height="112" rx="12" fill="#EFF6FF" clipPath="url(#reveal)" />
      <text x="50" y="74" fontFamily="system-ui" fontWeight="800" fontSize="16" fill="#0F172A">$5.00</text>
      <text x="50" y="92" fontFamily="system-ui" fontWeight="600" fontSize="10" fill="#38BDF8">USDC</text>
      {/* Centre label */}
      <text x="160" y="90" textAnchor="middle" fontFamily="system-ui" fontWeight="700" fontSize="12" fill="rgba(15,23,42,0.3)">SCRATCH HERE</text>
      {/* Bottom */}
      <text x="160" y="175" textAnchor="middle" fontFamily="system-ui" fontWeight="600" fontSize="10" fill="rgba(15,23,42,0.35)">Scratch &amp; Split · Arc Testnet</text>
    </svg>
  )
}

function CoffeeMockup() {
  return (
    <svg viewBox="0 0 320 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full max-w-sm mx-auto drop-shadow-lg">
      {/* Phone */}
      <rect x="90" y="4" width="140" height="192" rx="20" fill="white" stroke="rgba(15,23,42,0.08)" strokeWidth="1.5" />
      <rect x="98" y="22" width="124" height="156" rx="10" fill="#F8FAFC" />
      {/* Amount block */}
      <rect x="106" y="30" width="108" height="52" rx="10" fill="#0F172A" />
      <text x="160" y="52" textAnchor="middle" fontFamily="system-ui" fontWeight="800" fontSize="20" fill="white">$1.00</text>
      <text x="160" y="70" textAnchor="middle" fontFamily="system-ui" fontWeight="600" fontSize="10" fill="rgba(255,255,255,0.65)">USDC · Coffee Treat</text>
      {/* Message bubble */}
      <rect x="106" y="92" width="108" height="30" rx="8" fill="rgba(15,23,42,0.05)" />
      <text x="160" y="112" textAnchor="middle" fontFamily="system-ui" fontSize="10" fill="rgba(15,23,42,0.55)">Enjoy your morning!</text>
      {/* Claim button */}
      <rect x="106" y="132" width="108" height="28" rx="8" fill="#38BDF8" />
      <text x="160" y="151" textAnchor="middle" fontFamily="system-ui" fontWeight="700" fontSize="11" fill="#0F172A">Scratch to Claim</text>
      {/* Home bar */}
      <rect x="136" y="170" width="48" height="3" rx="2" fill="rgba(15,23,42,0.15)" />
    </svg>
  )
}

function PasskeyMockup() {
  return (
    <svg viewBox="0 0 320 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full max-w-sm mx-auto drop-shadow-lg">
      {/* Card */}
      <rect x="16" y="16" width="288" height="168" rx="20" fill="white" stroke="rgba(15,23,42,0.08)" strokeWidth="1.5" />
      {/* Header band */}
      <rect x="16" y="16" width="288" height="64" rx="20" fill="#0F172A" />
      <rect x="16" y="60" width="288" height="20" fill="#0F172A" />
      <text x="160" y="44" textAnchor="middle" fontFamily="system-ui" fontWeight="700" fontSize="13" fill="white">Claim Your Gift</text>
      <text x="160" y="62" textAnchor="middle" fontFamily="system-ui" fontSize="10" fill="rgba(255,255,255,0.5)">No account needed</text>
      {/* Fingerprint graphic */}
      <circle cx="160" cy="128" r="34" fill="rgba(56,189,248,0.08)" />
      <circle cx="160" cy="128" r="22" fill="none" stroke="#38BDF8" strokeWidth="1.5" strokeDasharray="4 3" />
      {/* Fingerprint arcs */}
      <path d="M148 128 Q148 116 160 116 Q172 116 172 128 Q172 138 164 143 Q156 138 148 134" stroke="#38BDF8" strokeWidth="2" fill="none" strokeLinecap="round"/>
      <path d="M144 122 Q142 110 160 108 Q178 110 176 122" stroke="#38BDF8" strokeWidth="2" fill="none" strokeLinecap="round"/>
      <path d="M152 140 Q160 147 168 140" stroke="#38BDF8" strokeWidth="2" fill="none" strokeLinecap="round"/>
      {/* Label */}
      <text x="160" y="175" textAnchor="middle" fontFamily="system-ui" fontWeight="600" fontSize="10" fill="rgba(15,23,42,0.35)">Face ID · Touch ID · Passkey</text>
    </svg>
  )
}

// ── Use cases ─────────────────────────────────────────────────────────────────

const USE_CASES = [
  {
    tag: 'Birthdays',
    headline: 'Make a birthday unforgettable',
    body: 'Hide USDC under a metallic scratch foil alongside a secret photo and message. They scratch the card, reveal the surprise, and the money lands in their wallet in under a second.',
    cta: 'Send a birthday gift',
    Visual: ScratchCardMockup,
    flip: false,
  },
  {
    tag: 'Everyday treats',
    headline: 'Buy someone a coffee from anywhere',
    body: '$1 USDC, 30 seconds, any phone. No app to download. No wallet to set up. Share the link by text or WhatsApp — they claim it instantly.',
    cta: 'Try a $1 gift',
    Visual: CoffeeMockup,
    flip: true,
  },
  {
    tag: 'Cross-border',
    headline: 'Send to anyone, anywhere — no bank needed',
    body: 'Recipients claim with a fingerprint tap using a passkey wallet. No seed phrase, no exchange account, no KYC. USDC settles instantly on Arc regardless of borders.',
    cta: 'See how claiming works',
    Visual: PasskeyMockup,
    flip: false,
  },
]

export default function UseCaseSection({ onCreateGift, onSignIn }: Props) {
  const { authenticated } = usePrivy()

  return (
    <section className="w-full">
      {USE_CASES.map((uc, i) => (
        <div
          key={uc.tag}
          className="w-full py-20 px-6 md:px-16 lg:px-24"
          style={{ background: i % 2 === 0 ? '#F8FAFC' : '#fff' }}
        >
          <div
            className={`max-w-7xl mx-auto flex flex-col ${uc.flip ? 'md:flex-row-reverse' : 'md:flex-row'} items-center gap-12 md:gap-20`}
          >
            {/* Text side */}
            <motion.div
              className="flex-1 flex flex-col gap-5"
              initial={{ opacity: 0, x: uc.flip ? 24 : -24 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ type: 'spring', stiffness: 180, damping: 24 }}
            >
              <span
                className="font-body text-xs font-800 tracking-widest uppercase w-fit px-3 py-1.5 rounded-xl"
                style={{ color: '#38BDF8', background: 'rgba(56,189,248,0.10)' }}
              >
                {uc.tag}
              </span>
              <h2
                className="font-display text-3xl md:text-4xl lg:text-5xl leading-tight"
                style={{ color: '#0F172A', letterSpacing: '-0.025em' }}
              >
                {uc.headline}
              </h2>
              <p
                className="font-body text-base md:text-lg leading-relaxed max-w-md"
                style={{ color: 'rgba(15,23,42,0.55)' }}
              >
                {uc.body}
              </p>
              <motion.button
                onClick={authenticated ? onCreateGift : onSignIn}
                whileHover={{ x: 4 }}
                whileTap={{ scale: 0.97 }}
                className="font-display text-base w-fit flex items-center gap-2"
                style={{ color: '#38BDF8' }}
              >
                {uc.cta} →
              </motion.button>
            </motion.div>

            {/* Visual side */}
            <motion.div
              className="flex-1 w-full"
              initial={{ opacity: 0, x: uc.flip ? -24 : 24 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ type: 'spring', stiffness: 180, damping: 24, delay: 0.08 }}
            >
              <uc.Visual />
            </motion.div>
          </div>
        </div>
      ))}
    </section>
  )
}
