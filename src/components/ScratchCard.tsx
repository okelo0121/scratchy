import { useEffect, useRef, useState, useCallback } from 'react'
import { motion } from 'framer-motion'

interface Props {
  photoDataUri: string | null
  message: string
  amountUsdc: string | null
  onFullyRevealed: () => void
}

const REVEAL_THRESHOLD = 0.65   // 65% scratched → auto-reveal
const BRUSH_RADIUS = 28
const SAMPLE_EVERY = 16         // check 1-in-16 pixels for perf

// Metallic foil gradient colors
const FOIL_COLORS = ['#C0C0C0', '#D8D8D8', '#A0A0A0', '#E8E8E8', '#B8B8B8']

export default function ScratchCard({ photoDataUri, message, amountUsdc, onFullyRevealed }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [revealed, setRevealed] = useState(false)
  const [scratchPct, setScratchPct] = useState(0)
  const isDrawing = useRef(false)
  const revealedRef = useRef(false)

  // Draw the metallic foil onto the canvas
  const drawFoil = useCallback((canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const { width, height } = canvas

    // Base silver gradient
    const grad = ctx.createLinearGradient(0, 0, width, height)
    FOIL_COLORS.forEach((c, i) => grad.addColorStop(i / (FOIL_COLORS.length - 1), c))
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, width, height)

    // Shimmer lines
    ctx.globalAlpha = 0.18
    for (let i = 0; i < 24; i++) {
      const x = (i / 24) * width
      ctx.strokeStyle = i % 2 === 0 ? '#ffffff' : '#909090'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x + 30, height)
      ctx.stroke()
    }
    ctx.globalAlpha = 1

    // "Scratch here" text
    ctx.fillStyle = 'rgba(60,60,60,0.5)'
    ctx.font = 'bold 18px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('✦ SCRATCH HERE ✦', width / 2, height / 2)
    ctx.font = '13px system-ui, sans-serif'
    ctx.fillStyle = 'rgba(80,80,80,0.4)'
    ctx.fillText('Rub with finger or mouse', width / 2, height / 2 + 28)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || revealed) return
    drawFoil(canvas)
  }, [drawFoil, revealed])

  const getScratchPct = useCallback((canvas: HTMLCanvasElement): number => {
    const ctx = canvas.getContext('2d')
    if (!ctx) return 0
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
    let transparent = 0
    let total = 0
    for (let i = 3; i < data.length; i += 4 * SAMPLE_EVERY) {
      if (data[i] < 128) transparent++
      total++
    }
    return total > 0 ? transparent / total : 0
  }, [])

  const scratch = useCallback((canvas: HTMLCanvasElement, x: number, y: number) => {
    const ctx = canvas.getContext('2d')
    if (!ctx || revealedRef.current) return
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const cx = (x - rect.left) * scaleX
    const cy = (y - rect.top) * scaleY
    ctx.globalCompositeOperation = 'destination-out'
    ctx.beginPath()
    ctx.arc(cx, cy, BRUSH_RADIUS, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalCompositeOperation = 'source-over'

    const pct = getScratchPct(canvas)
    setScratchPct(Math.round(pct * 100))
    if (pct >= REVEAL_THRESHOLD) {
      revealedRef.current = true
      setRevealed(true)
      onFullyRevealed()
    }
  }, [getScratchPct, onFullyRevealed])

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    isDrawing.current = true
    scratch(canvasRef.current!, e.clientX, e.clientY)
    canvasRef.current?.setPointerCapture(e.pointerId)
  }
  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawing.current) return
    scratch(canvasRef.current!, e.clientX, e.clientY)
  }
  function handlePointerUp() { isDrawing.current = false }

  function revealAll() {
    revealedRef.current = true
    setRevealed(true)
    onFullyRevealed()
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Card body — revealed content beneath foil */}
      <div
        className="relative rounded-3xl overflow-hidden"
        style={{ border: '3px solid #A78BFA', boxShadow: '0 8px 0 0 #7C3AED' }}
      >
        {/* Revealed layer (always rendered, behind canvas) */}
        <div className="p-6 flex flex-col gap-4 min-h-[320px]" style={{ background: 'linear-gradient(135deg,#F5F3FF,#EDE9FE)' }}>
          {photoDataUri ? (
            <img src={photoDataUri} alt="Gift surprise" className="w-full rounded-2xl object-cover" style={{ maxHeight: 200 }} />
          ) : (
            <div className="w-full rounded-2xl flex items-center justify-center" style={{ height: 160, background: '#EDE9FE' }}>
              <span style={{ fontSize: 64 }}>🎁</span>
            </div>
          )}
          {message && (
            <div className="rounded-2xl px-4 py-3" style={{ background: 'white', border: '2px solid #C4B5FD' }}>
              <p className="font-body text-base text-navy leading-relaxed">{message}</p>
            </div>
          )}
          {amountUsdc && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.2 }}
              className="rounded-2xl py-4 text-center"
              style={{ background: 'linear-gradient(135deg,#A78BFA,#818CF8)', boxShadow: '0 4px 0 0 #4F46E5' }}
            >
              <p className="font-body text-sm font-800 text-white/80">🔓 Unlocked</p>
              <p className="font-display text-4xl text-white">{parseFloat(amountUsdc).toFixed(2)} USDC</p>
            </motion.div>
          )}
        </div>

        {/* Foil canvas — sits on top until scratched away */}
        {!revealed && (
          <canvas
            ref={canvasRef}
            width={640}
            height={480}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className="absolute inset-0 w-full h-full cursor-crosshair touch-none"
            style={{ borderRadius: '1.25rem' }}
          />
        )}
      </div>

      {/* Progress + reveal-all */}
      {!revealed && (
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 rounded-full overflow-hidden" style={{ height: 12, background: '#E2E8F0' }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: 'linear-gradient(90deg,#A78BFA,#34D399)', width: `${scratchPct}%` }}
              animate={{ width: `${scratchPct}%` }}
              transition={{ duration: 0.1 }}
            />
          </div>
          <span className="font-body text-xs font-800 text-navy/50 flex-shrink-0">{scratchPct}%</span>
          <button onClick={revealAll} className="font-body text-xs font-700 text-navy/50 underline flex-shrink-0">
            Reveal all
          </button>
        </div>
      )}
    </div>
  )
}
