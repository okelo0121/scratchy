import { motion } from 'framer-motion'

// ── SVG icons (24×24 viewBox, stroke only) ───────────────────────────────────
function IconGift() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 12 20 22 4 22 4 12" />
      <rect x="2" y="7" width="20" height="5" />
      <line x1="12" y1="22" x2="12" y2="7" />
      <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
      <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
    </svg>
  )
}
function IconCamera() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  )
}
function IconLink() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  )
}
function IconCoin() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v2m0 8v2m-4-6h8" />
      <path d="M9.5 9.5a3 3 0 0 1 5 0 3 3 0 0 1-5 5" />
    </svg>
  )
}

const STEPS = [
  {
    num: 1,
    Icon: IconGift,
    title: 'Pick Your Gift',
    body: 'Choose an occasion and USDC amount — Birthday, Coffee Treat, Congrats, or custom.',
    action: 'Step 1',
  },
  {
    num: 2,
    Icon: IconCamera,
    title: 'Add a Surprise',
    body: 'Drop in a secret photo and personal message hidden under the scratch foil.',
    action: 'Step 2',
  },
  {
    num: 3,
    Icon: IconLink,
    title: 'Share the Link',
    body: 'We lock your USDC onchain and give you a link to send by text, email, or DM.',
    action: 'Step 3',
  },
  {
    num: 4,
    Icon: IconCoin,
    title: 'Scratch & Claim',
    body: 'The recipient scratches the card, reveals the surprise, and claims USDC instantly.',
    action: 'Step 4',
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
    <section className="w-full py-20 px-6 md:px-16 lg:px-24" style={{ background: '#fff' }}>
      <div className="max-w-7xl mx-auto">
        {/* Heading */}
        <div className="text-center mb-12">
          <span
            className="font-body text-xs font-800 tracking-widest uppercase"
            style={{ color: '#38BDF8' }}
          >
            How it works
          </span>
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            className="font-display text-4xl md:text-5xl text-navy mt-2"
            style={{ letterSpacing: '-0.025em' }}
          >
            Four steps, under a minute
          </motion.h2>
          <p className="font-body mt-3 text-base max-w-lg mx-auto" style={{ color: 'rgba(15,23,42,0.5)' }}>
            No setup, no jargon — pick, send, scratch, claim.
          </p>
        </div>

        {/* Step cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {STEPS.map((s, i) => (
            <motion.div
              key={s.num}
              custom={i}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={cardVariants}
              whileHover={{ y: -4 }}
              className="rounded-2xl flex flex-col overflow-hidden"
              style={{ border: '1.5px solid rgba(15,23,42,0.08)', background: '#FAFAFA' }}
            >
              {/* Top accent bar */}
              <div className="h-1 w-full" style={{ background: '#38BDF8' }} />

              <div className="p-6 flex flex-col gap-4 flex-1">
                {/* Step label + icon */}
                <div className="flex items-center justify-between">
                  <span
                    className="font-body text-xs font-800 tracking-widest uppercase"
                    style={{ color: '#38BDF8' }}
                  >
                    {s.action}
                  </span>
                  <span style={{ color: '#0F172A', opacity: 0.25 }}>
                    <s.Icon />
                  </span>
                </div>

                {/* Title */}
                <h3
                  className="font-display text-xl leading-tight"
                  style={{ color: '#0F172A', letterSpacing: '-0.02em' }}
                >
                  {s.title}
                </h3>

                {/* Body */}
                <p
                  className="font-body text-sm leading-relaxed flex-1"
                  style={{ color: 'rgba(15,23,42,0.55)' }}
                >
                  {s.body}
                </p>

                {/* Step number — decorative */}
                <span
                  className="font-display text-6xl leading-none self-end select-none"
                  style={{ color: 'rgba(56,189,248,0.12)', letterSpacing: '-0.04em' }}
                >
                  {s.num}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
