import { motion } from 'framer-motion'

interface Props {
  step: 'idle' | 'sending' | 'confirming' | 'success' | 'error'
  errorMsg?: string | null
  txHash?: string
}

const CHAIN_EXPLORER = 'https://explorer.testnet.arc.io/tx/'

export default function TxStatusBadge({ step, errorMsg, txHash }: Props) {
  if (step === 'idle') return null

  const configs = {
    sending:    { bg: '#FEF3C7', border: '#FCD34D', shadow: '#F59E0B', text: '#92400E', label: '⏳ Sending to wallet...' },
    confirming: { bg: '#EFF6FF', border: '#93C5FD', shadow: '#3B82F6', text: '#1E40AF', label: '🔵 Confirming on Arc...' },
    success:    { bg: '#ECFDF5', border: '#6EE7B7', shadow: '#10B981', text: '#065F46', label: '✅ Confirmed!' },
    error:      { bg: '#FFF1F2', border: '#FDA4AF', shadow: '#F43F5E', text: '#9F1239', label: `❌ ${errorMsg ?? 'Transaction failed'}` },
  }
  const c = configs[step]

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className="rounded-2xl px-4 py-3 flex items-center justify-between gap-3"
      style={{ background: c.bg, border: `2.5px solid ${c.border}`, boxShadow: `0 4px 0 0 ${c.shadow}` }}
    >
      <span className="font-body font-800 text-sm" style={{ color: c.text }}>{c.label}</span>
      {step === 'success' && txHash && (
        <a
          href={`${CHAIN_EXPLORER}${txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-body text-xs font-700 underline"
          style={{ color: c.text }}
        >
          View ↗
        </a>
      )}
    </motion.div>
  )
}
