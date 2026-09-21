import { motion } from 'framer-motion'

interface MascotSVGProps {
  size?: number
  animate?: boolean
  expression?: 'happy' | 'thinking' | 'excited' | 'teaching'
  festive?: boolean
}

export default function MascotSVG({ size = 80, animate = true, expression = 'happy', festive = false }: MascotSVGProps) {
  const eyeVariants = {
    happy:    { d: 'M 8 10 Q 10 7 12 10', stroke: '#3B1F0A' },
    thinking: { d: 'M 8 10 Q 10 9 12 10', stroke: '#3B1F0A' },
    excited:  { d: 'M 8 9  Q 10 6 12 9',  stroke: '#3B1F0A' },
    teaching: { d: 'M 8 10 Q 10 8 12 10', stroke: '#3B1F0A' },
  }
  const eye = eyeVariants[expression]

  return (
    <motion.div
      style={{ width: size, height: size, position: 'relative', display: 'inline-block' }}
      animate={animate ? { y: [0, -6, 0] } : undefined}
      transition={animate ? { duration: 2.4, repeat: Infinity, ease: 'easeInOut' } : undefined}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 80 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Body */}
        <ellipse cx="40" cy="52" rx="26" ry="24" fill="#F59E0B" />
        <ellipse cx="40" cy="52" rx="18" ry="17" fill="#FEF3C7" />

        {/* Wings */}
        <ellipse cx="16" cy="54" rx="10" ry="14" fill="#D97706" transform="rotate(-18 16 54)" />
        <ellipse cx="64" cy="54" rx="10" ry="14" fill="#D97706" transform="rotate(18 64 54)" />

        {/* Head */}
        <ellipse cx="40" cy="28" rx="22" ry="20" fill="#F59E0B" />

        {/* Ear tufts */}
        <polygon points="24,12 20,2 28,10" fill="#D97706" />
        <polygon points="56,12 60,2 52,10" fill="#D97706" />

        {/* Face plate */}
        <ellipse cx="40" cy="30" rx="14" ry="13" fill="#FEF3C7" />

        {/* Eyes */}
        <circle cx="33" cy="26" r="6.5" fill="white" stroke="#D97706" strokeWidth="1.5" />
        <circle cx="47" cy="26" r="6.5" fill="white" stroke="#D97706" strokeWidth="1.5" />
        <circle cx="34" cy="26" r="3.5" fill="#1C1C1E" />
        <circle cx="48" cy="26" r="3.5" fill="#1C1C1E" />
        <circle cx="35" cy="24.5" r="1.2" fill="white" />
        <circle cx="49" cy="24.5" r="1.2" fill="white" />

        {/* Beak */}
        <path d="M 37 33 L 40 38 L 43 33 Z" fill="#F97316" />

        {/* Expression mouth */}
        <path d={eye.d} stroke={eye.stroke} strokeWidth="1.5" fill="none" strokeLinecap="round"
          transform="translate(27 8)" />

        {/* Blush spots */}
        <ellipse cx="27" cy="34" rx="4" ry="2.5" fill="#FCA5A5" opacity="0.6" />
        <ellipse cx="53" cy="34" rx="4" ry="2.5" fill="#FCA5A5" opacity="0.6" />

        {/* Feet */}
        <ellipse cx="32" cy="74" rx="7" ry="3.5" fill="#F97316" />
        <ellipse cx="48" cy="74" rx="7" ry="3.5" fill="#F97316" />

        {/* Festive party hat */}
        {festive && (
          <g>
            <polygon points="40,2 28,18 52,18" fill="#A78BFA" />
            <polygon points="40,2 28,18 52,18" fill="url(#hatStripe)" opacity="0.5" />
            <ellipse cx="40" cy="18" rx="12" ry="3" fill="#7C3AED" />
            <circle cx="40" cy="2" r="3" fill="#FCD34D" />
            {/* Hat stars */}
            <text x="31" y="14" fontSize="5" fill="#FDE68A">★</text>
            <text x="41" y="12" fontSize="4" fill="#FDE68A">✦</text>
            {/* Confetti streamers */}
            <line x1="52" y1="18" x2="60" y2="8" stroke="#F87171" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="61" cy="7" r="2" fill="#F87171" />
            <line x1="28" y1="18" x2="20" y2="10" stroke="#34D399" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="19" cy="9" r="2" fill="#34D399" />
          </g>
        )}
        <defs>
          <pattern id="hatStripe" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="#C4B5FD" strokeWidth="3" />
          </pattern>
        </defs>
      </svg>
    </motion.div>
  )
}
