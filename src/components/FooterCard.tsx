import { motion } from 'framer-motion'
import MascotSVG from './MascotSVG'

const LINKS = [
  { label: 'Create a Gift', anchor: 'create' },
  { label: 'How It Works',  anchor: 'how' },
  { label: 'Claim a Gift',  anchor: 'gift' },
]

interface Props {
  onNavigate?: (view: string) => void
}

export default function FooterCard({ onNavigate }: Props) {
  return (
    <footer className="w-full" style={{ background: '#0F172A' }}>
      <div className="max-w-7xl mx-auto px-6 md:px-16 lg:px-24 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">

          {/* Brand */}
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <MascotSVG size={48} animate={false} expression="happy" festive />
              <div>
                <div className="font-display text-xl text-white leading-tight">Scratch &amp; Split</div>
                <div className="font-body text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Magical USDC gifts on Arc
                </div>
              </div>
            </div>
            <p className="font-body text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Send surprise USDC gift cards with hidden photos and messages — instant, cheap, magical.
            </p>
            <div className="flex flex-wrap gap-2">
              {['Sub-second finality', 'USDC native gas'].map((t) => (
                <span
                  key={t}
                  className="font-body text-xs font-700 rounded-xl px-3 py-1.5"
                  style={{ background: 'rgba(56,189,248,0.12)', color: '#38BDF8' }}
                >
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* Links */}
          <div className="flex flex-col gap-3">
            <div className="font-display text-base text-white mb-2">Quick Links</div>
            {LINKS.map((link) => (
              <motion.button
                key={link.label}
                onClick={() => onNavigate?.(link.anchor)}
                whileHover={{ x: 4 }}
                className="text-left font-body text-sm w-fit"
                style={{ color: 'rgba(255,255,255,0.55)' }}
              >
                {link.label} →
              </motion.button>
            ))}
            <a
              href="https://explorer.testnet.arc.io"
              target="_blank"
              rel="noopener noreferrer"
              className="font-body text-sm w-fit"
              style={{ color: 'rgba(255,255,255,0.55)' }}
            >
              Arc Explorer ↗
            </a>
          </div>

          {/* Chain info */}
          <div className="flex flex-col gap-3">
            <div className="font-display text-base text-white mb-2">Network</div>
            {[
              ['Chain', 'Arc Testnet'],
              ['Chain ID', '5042002'],
              ['Gas token', 'USDC'],
              ['Finality', '< 1 second'],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between max-w-xs">
                <span className="font-body text-sm" style={{ color: 'rgba(255,255,255,0.38)' }}>{k}</span>
                <span className="font-body text-sm font-700" style={{ color: '#38BDF8' }}>{v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom bar */}
        <div
          className="mt-12 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3"
          style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}
        >
          <span className="font-body text-xs" style={{ color: 'rgba(255,255,255,0.28)' }}>
            © {new Date().getFullYear()} Scratch &amp; Split. Built on Arc Testnet.
          </span>
          <span className="font-body text-xs" style={{ color: 'rgba(255,255,255,0.28)' }}>
            Testnet only — not real funds.
          </span>
        </div>
      </div>
    </footer>
  )
}
