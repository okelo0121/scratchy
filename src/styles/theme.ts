// TutorQuest design tokens

export const COLORS = {
  sky: '#38BDF8',
  skyLight: '#BAE6FD',
  skyDark: '#0284C7',
  sunshine: '#FBBF24',
  sunshineLight: '#FEF3C7',
  sunshineDark: '#D97706',
  coral: '#FB7185',
  coralLight: '#FFE4E6',
  coralDark: '#E11D48',
  mint: '#34D399',
  mintLight: '#D1FAE5',
  mintDark: '#059669',
  lavender: '#A78BFA',
  lavenderLight: '#EDE9FE',
  lavenderDark: '#7C3AED',
  canvas: '#FFFBF5',
  navy: '#1E293B',
  white: '#FFFFFF',
} as const

export const SUBJECTS = {
  reading: { color: 'coral', bg: 'bg-coral-light', text: 'text-coral-dark', accent: '#FB7185', label: 'Reading' },
  writing: { color: 'sky', bg: 'bg-sky-light', text: 'text-sky-dark', accent: '#38BDF8', label: 'Writing' },
  arithmetic: { color: 'mint', bg: 'bg-mint-light', text: 'text-mint-dark', accent: '#34D399', label: 'Arithmetic' },
} as const

export const SPRING = {
  type: 'spring' as const,
  stiffness: 400,
  damping: 25,
}

export const SPRING_GENTLE = {
  type: 'spring' as const,
  stiffness: 200,
  damping: 20,
}
