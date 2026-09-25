import { motion } from 'framer-motion'

const STATS = [
  { value: '< 1s',  label: 'Finality on Arc',            sub: 'Sub-second settlement' },
  { value: 'USDC',  label: 'Native gas token',           sub: 'No ETH needed — ever' },
  { value: '0',     label: 'Wallet setup for recipient', sub: 'Scratch and claim, done' },
  { value: '100%',  label: 'Onchain',                    sub: 'Funds locked in a contract' },
]

export default function StatsBar() {
  return (
    <section className="w-full py-14 px-6 md:px-16 lg:px-24" style={{ background: '#0F172A' }}>
      <div className="max-w-7xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-6">
        {STATS.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ type: 'spring', stiffness: 200, damping: 22, delay: i * 0.07 }}
            className="flex flex-col gap-1.5"
          >
            <span
              className="font-display text-4xl lg:text-5xl leading-none"
              style={{ color: '#38BDF8', letterSpacing: '-0.03em' }}
            >
              {s.value}
            </span>
            <span className="font-display text-sm text-white leading-tight mt-1">{s.label}</span>
            <span className="font-body text-xs" style={{ color: 'rgba(255,255,255,0.42)' }}>{s.sub}</span>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
