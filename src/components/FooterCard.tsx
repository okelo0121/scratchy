import { motion } from 'framer-motion'
import MascotSVG from './MascotSVG'

const CONFETTI = [
  { x: '8%',   y: '20%', c: '#F87171', s: 8 },
  { x: '15%',  y: '70%', c: '#FCD34D', s: 6 },
  { x: '25%',  y: '40%', c: '#34D399', s: 10 },
  { x: '38%',  y: '80%', c: '#A78BFA', s: 7 },
  { x: '52%',  y: '15%', c: '#38BDF8', s: 9 },
  { x: '63%',  y: '60%', c: '#F87171', s: 6 },
  { x: '74%',  y: '30%', c: '#FCD34D', s: 8 },
  { x: '83%',  y: '75%', c: '#34D399', s: 7 },
  { x: '92%',  y: '20%', c: '#A78BFA', s: 10 },
  { x: '47%',  y: '50%', c: '#38BDF8', s: 5 },
  { x: '5%',   y: '50%', c: '#FCD34D', s: 7 },
  { x: '88%',  y: '55%', c: '#F87171', s: 6 },
]

const LINKS = [
  { label: 'Create a Gift', anchor: 'create' },
  { label: 'How It Works', anchor: 'how' },
  { label: 'Claim a Gift', anchor: 'gift' },
]

interface Props {
  onNavigate?: (view: string) => void
}

export default function FooterCard({ onNavigate }: Props) {
  return (
    <div className="mx-auto max-w-3xl">
      <div
        className="relative rounded-3xl overflow-hidden px-6 py-10"
        style={{
          background: 'linear-gradient(135deg, #1E1B4B 0%, #312E81 50%, #1E3A5F 100%)',
          border: '3px solid rgba(167,139,250,0.3)',
          boxShadow: '0 8px 0 0 rgba(0,0,0,0.35), 0 4px 40px -8px rgba(167,139,250,0.4)',
        }}
      >
        {/* Confetti dots */}
        {CONFETTI.map((dot, i) => (
          <div
            key={i}
            className="absolute rounded-full pointer-events-none"
            style={{ left: dot.x, top: dot.y, width: dot.s, height: dot.s, background: dot.c, opacity: 0.55 }}
          />
        ))}

        {/* 3-column grid */}
        <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-8">

          {/* Left — Brand */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <MascotSVG size={56} animate={false} expression="happy" festive />
              <div>
                <div className="font-display text-2xl text-white leading-tight">Scratch & Split</div>
                <div className="font-body text-xs font-700 text-white/55 mt-0.5">Magical USDC gifts on Arc</div>
              </div>
            </div>
            <p className="font-body text-sm text-white/65 leading-relaxed">
              Send surprise USDC gift cards with hidden photos and personal messages — instant, cheap, magical.
            </p>
            <div className="flex flex-wrap gap-2">
              {[{ icon: '⚡', text: 'Sub-second finality' }, { icon: '💸', text: 'USDC native gas' }].map((pill) => (
                <div
                  key={pill.text}
                  className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-body text-xs font-800"
                  style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.85)' }}
                >
                  {pill.icon} {pill.text}
                </div>
              ))}
            </div>
          </div>

          {/* Centre — Links */}
          <div
            className="rounded-2xl p-5 flex flex-col gap-3"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1.5px solid rgba(255,255,255,0.12)' }}
          >
            <div className="font-display text-lg text-white mb-1">Quick Links</div>
            {LINKS.map((link) => (
              <motion.button
                key={link.label}
                onClick={() => onNavigate?.(link.anchor)}
                whileHover={{ x: 4 }}
                className="text-left font-body text-sm font-700 rounded-xl px-3 py-2 transition-colors"
                style={{ color: 'rgba(255,255,255,0.75)', background: 'rgba(255,255,255,0.06)' }}
              >
                {link.label} →
              </motion.button>
            ))}
            <a
              href="https://explorer.testnet.arc.io"
              target="_blank"
              rel="noopener noreferrer"
              className="text-left font-body text-sm font-700 rounded-xl px-3 py-2"
              style={{ color: 'rgba(255,255,255,0.75)', background: 'rgba(255,255,255,0.06)' }}
            >
              Arc Explorer ↗
            </a>
          </div>

          {/* Right — Chain info */}
          <div
            className="rounded-2xl p-5 flex flex-col gap-3"
            style={{ background: 'linear-gradient(135deg,rgba(99,102,241,0.25),rgba(167,139,250,0.15))', border: '1.5px solid rgba(167,139,250,0.3)' }}
          >
            <div className="font-display text-lg text-white mb-1">⛓️ Powered by Arc</div>
            {[
              { dot: '#34D399', label: 'Network', value: 'Arc Testnet' },
              { dot: '#FCD34D', label: 'Gas token', value: 'USDC (no ETH)' },
              { dot: '#38BDF8', label: 'Finality', value: '< 1 second' },
            ].map((row) => (
              <div key={row.label} className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: row.dot }} />
                <span className="font-body text-xs text-white/55 flex-shrink-0">{row.label}:</span>
                <span className="font-body text-xs font-800 text-white/85">{row.value}</span>
              </div>
            ))}
            <a
              href={`https://explorer.testnet.arc.io/address/${import.meta.env.VITE_SCRATCH_CONTRACT ?? ''}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-body text-xs font-800 rounded-xl px-3 py-2 text-center mt-1"
              style={{ background: 'rgba(167,139,250,0.25)', color: '#C4B5FD' }}
            >
              View Contract ↗
            </a>
          </div>
        </div>

        {/* Bottom strip */}
        <div className="relative z-10 mt-8 pt-5 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span className="font-body text-xs text-white/40">© 2026 Scratch & Split · Built on Arc</span>
          <span className="font-body text-xs text-white/30 text-center sm:text-right max-w-xs">
            Contracts are unaudited — use at your own risk on mainnet
          </span>
        </div>
      </div>
    </div>
  )
}
