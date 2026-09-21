/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Fredoka One"', 'cursive'],
        body: ['"Nunito"', 'sans-serif'],
      },
      fontWeight: {
        400: '400',
        500: '500',
        600: '600',
        700: '700',
        800: '800',
        900: '900',
      },
      colors: {
        sky: {
          DEFAULT: '#38BDF8',
          light: '#E0F4FF',
          dark: '#0284C7',
          deep: '#075985',
        },
        sunshine: {
          DEFAULT: '#FBBF24',
          light: '#FFF8E1',
          dark: '#D97706',
        },
        coral: {
          DEFAULT: '#F87171',
          light: '#FFF0F0',
          dark: '#DC2626',
        },
        mint: {
          DEFAULT: '#34D399',
          light: '#E6FBF2',
          dark: '#059669',
        },
        lavender: {
          DEFAULT: '#A78BFA',
          light: '#F0EEFF',
          dark: '#7C3AED',
          deep: '#5B21B6',
        },
        canvas: '#F0F9FF',
        navy: '#0F172A',
        cloud: '#FFFFFF',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      boxShadow: {
        card: '0 4px 0 0 rgba(15,23,42,0.12), 0 2px 16px -2px rgba(15,23,42,0.08)',
        pop: '0 6px 0 0 rgba(15,23,42,0.18), 0 4px 24px -4px rgba(15,23,42,0.14)',
        btn: '0 4px 0 0 rgba(15,23,42,0.25)',
        'btn-coral': '0 4px 0 0 #DC2626',
        'btn-sky': '0 4px 0 0 #0284C7',
        'btn-mint': '0 4px 0 0 #059669',
        'btn-sunshine': '0 4px 0 0 #D97706',
        'btn-lavender': '0 4px 0 0 #7C3AED',
        inner: 'inset 0 2px 6px rgba(15,23,42,0.06)',
        glow: '0 0 24px -4px rgba(167,139,250,0.5)',
      },
      animation: {
        float: 'float 4s ease-in-out infinite',
        'float-slow': 'float 7s ease-in-out infinite',
        wiggle: 'wiggle 0.5s ease-in-out',
        'spin-slow': 'spin 10s linear infinite',
        'bounce-soft': 'bounceSoft 2s ease-in-out infinite',
        drift: 'drift 20s linear infinite',
      },
      keyframes: {
        float: {
          '0%,100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-12px)' },
        },
        wiggle: {
          '0%,100%': { transform: 'rotate(-4deg)' },
          '50%': { transform: 'rotate(4deg)' },
        },
        bounceSoft: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        drift: {
          '0%': { transform: 'translateX(-10%)' },
          '100%': { transform: 'translateX(110%)' },
        },
      },
    },
  },
  plugins: [],
}
