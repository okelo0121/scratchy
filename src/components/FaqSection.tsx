import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const FAQS = [
  {
    q: 'Does the recipient need a crypto wallet?',
    a: 'No. Recipients can claim using Face ID or a fingerprint — a passkey wallet is created automatically with no seed phrase, no app install, and no account sign-up. Alternatively, sign in with Google or email and we set up a wallet automatically.',
  },
  {
    q: 'How long is the USDC locked in the gift?',
    a: 'Gifts expire after 30 days. If unclaimed, the sender can reclaim the full amount. The expiry is enforced onchain — no intermediary holds the funds.',
  },
  {
    q: 'What is Arc and why does it matter?',
    a: 'Arc is a blockchain where USDC is the native gas token. Transaction fees are paid in USDC — no ETH needed. Transactions settle in under a second, and fees are stable and predictable.',
  },
  {
    q: 'Can I send to someone in another country?',
    a: 'Yes. USDC is a global digital dollar. The recipient does not need a bank account. The gift link works on any phone with a browser. Cross-border settlement takes the same sub-second as any other Arc transaction.',
  },
  {
    q: "What happens if the recipient can't claim?",
    a: 'After 30 days the gift expires and you can refund the full amount from the dashboard. Nothing is ever lost — the smart contract only releases funds on a valid claim or refund.',
  },
  {
    q: 'Is my photo private?',
    a: "Yes. The photo is embedded directly in the gift link as an encoded fragment — it never hits a server. The URL fragment is not sent to any server by the browser, so only the person with the full link can see it.",
  },
]

export default function FaqSection() {
  const [open, setOpen] = useState<number | null>(null)

  return (
    <section className="w-full py-20 px-6 md:px-16 lg:px-24" style={{ background: '#F8FAFC' }}>
      <div className="max-w-3xl mx-auto">
        {/* Heading */}
        <motion.div
          className="mb-12"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ type: 'spring', stiffness: 200, damping: 22 }}
        >
          <span
            className="font-body text-xs font-800 tracking-widest uppercase"
            style={{ color: '#38BDF8' }}
          >
            FAQ
          </span>
          <h2
            className="font-display text-4xl md:text-5xl mt-2 leading-tight"
            style={{ color: '#0F172A', letterSpacing: '-0.025em' }}
          >
            Common questions
          </h2>
        </motion.div>

        {/* Accordion */}
        <div className="flex flex-col">
          {FAQS.map((faq, i) => (
            <motion.div
              key={faq.q}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ type: 'spring', stiffness: 200, damping: 22, delay: i * 0.04 }}
            >
              <div style={{ borderTop: '1px solid rgba(15,23,42,0.08)' }} />
              <button
                className="w-full flex items-center justify-between py-5 text-left gap-4"
                onClick={() => setOpen(open === i ? null : i)}
                aria-expanded={open === i}
              >
                <span
                  className="font-display text-lg leading-snug"
                  style={{ color: '#0F172A' }}
                >
                  {faq.q}
                </span>
                <motion.span
                  animate={{ rotate: open === i ? 45 : 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                  className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center font-body font-800 text-base select-none"
                  style={{
                    background: open === i ? '#38BDF8' : 'rgba(15,23,42,0.07)',
                    color: open === i ? '#0F172A' : 'rgba(15,23,42,0.5)',
                  }}
                >
                  +
                </motion.span>
              </button>
              <AnimatePresence initial={false}>
                {open === i && (
                  <motion.div
                    key="answer"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 280, damping: 28 }}
                    style={{ overflow: 'hidden' }}
                  >
                    <p
                      className="font-body text-base leading-relaxed pb-5 pr-12"
                      style={{ color: 'rgba(15,23,42,0.58)' }}
                    >
                      {faq.a}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
          <div style={{ borderTop: '1px solid rgba(15,23,42,0.08)' }} />
        </div>
      </div>
    </section>
  )
}
