import { motion } from 'framer-motion'

const STEPS = [
  {
    num: 1,
    emoji: '🎁',
    title: 'Pick Your Gift',
    body: 'Choose an occasion and USDC amount — Birthday, Coffee Treat, Congrats, or totally custom.',
    action: 'Pick',
    headerFrom: '#F87171',
    headerTo: '#FCA5A5',
    border: '#F87171',
    shadow: '#DC2626',
    pill: '#FFF1F2',
    pillText: '#DC2626',
  },
  {
    num: 2,
    emoji: '📸',
    title: 'Add a Surprise',
    body: 'Drop in a secret photo and personal message hidden under the metallic scratch foil.',
    action: 'Upload',
    headerFrom: '#38BDF8',
    headerTo: '#7DD3FC',
    border: '#38BDF8',
    shadow: '#0284C7',
    pill: '#F0F9FF',
    pillText: '#0369A1',
  },
  {
    num: 3,
    emoji: '🔗',
    title: 'Share the Link',
    body: 'We lock your USDC onchain and give you a magic link to send by text, email, or DM.',
    action: 'Share',
    headerFrom: '#A78BFA',
    headerTo: '#C4B5FD',
    border: '#A78BFA',
    shadow: '#7C3AED',
    pill: '#F5F3FF',
    pillText: '#6D28D9',
  },
  {
    num: 4,
    emoji: '🪙',
    title: 'Scratch & Claim',
    body: 'The recipient scratches the card, reveals the surprise, and claims the USDC instantly.',
    action: 'Claim',
    headerFrom: '#34D399',
    headerTo: '#6EE7B7',
    border: '#34D399',
    shadow: '#059669',
    pill: '#ECFDF5',
    pillText: '#047857',
  },
]

const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 200, damping: 22, delay: i * 0.1 },
  }),
}

export default function HowItWorks() {
  return (
    <section className="py-10">
      {/* Heading */}
      <div className="text-center mb-8">
        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          className="font-display text-4xl md:text-5xl text-navy"
          style={{ letterSpacing: '-0.02em' }}
        >
          ✨ How It Works
        </motion.h2>
        <p className="font-body text-navy/55 mt-2 text-base font-600">Four magical steps — done in under a minute</p>
      </div>

      {/* Step cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {STEPS.map((s, i) => (
          <motion.div
            key={s.num}
            custom={i}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={cardVariants}
            whileHover={{ y: -4 }}
            className="rounded-3xl overflow-hidden flex flex-col"
            style={{
              border: `3px solid ${s.border}`,
              boxShadow: `0 6px 0 0 ${s.shadow}, 0 2px 20px -4px ${s.border}44`,
              background: 'white',
            }}
          >
            {/* Coloured header strip */}
            <div
              className="relative flex items-center justify-center py-5"
              style={{ background: `linear-gradient(135deg, ${s.headerFrom}, ${s.headerTo})` }}
            >
              {/* Step number badge */}
              <div
                className="absolute top-3 left-3 w-7 h-7 rounded-full flex items-center justify-center font-display text-sm"
                style={{ background: 'white', color: s.shadow }}
              >
                {s.num}
              </div>
              <span style={{ fontSize: 40 }}>{s.emoji}</span>
            </div>

            {/* Body */}
            <div className="p-4 flex-1 flex flex-col gap-3">
              <h3 className="font-display text-xl text-navy leading-tight">{s.title}</h3>
              <p className="font-body text-sm text-navy/65 leading-relaxed flex-1">{s.body}</p>
              {/* Action pill */}
              <div
                className="inline-flex items-center self-start rounded-xl px-3 py-1 font-body text-xs font-800"
                style={{ background: s.pill, color: s.pillText }}
              >
                {s.action} →
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
