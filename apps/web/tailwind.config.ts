import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        angora: {
          bg: '#08000F',
          surface: '#0D0020',
          card: '#130025',
          border: '#2D1B69',
          primary: '#836EF9',
          'primary-dim': '#5A4AB0',
          accent: '#C4B5FD',
          accent2: '#A78BFA',
          muted: '#9CA3AF',
          success: '#34D399',
          danger: '#F87171',
          warning: '#FBBF24',
          cyan: '#22D3EE',
        },
        border: '#2D1B69',
        input: '#0D0020',
        ring: '#836EF9',
        background: '#08000F',
        foreground: '#ffffff',
        primary: {
          DEFAULT: '#836EF9',
          foreground: '#ffffff',
        },
        secondary: {
          DEFAULT: '#130025',
          foreground: '#C4B5FD',
        },
        muted: {
          DEFAULT: '#130025',
          foreground: '#9CA3AF',
        },
        accent: {
          DEFAULT: '#130025',
          foreground: '#C4B5FD',
        },
        destructive: {
          DEFAULT: '#F87171',
          foreground: '#ffffff',
        },
        card: {
          DEFAULT: '#0D0020',
          foreground: '#ffffff',
        },
        popover: {
          DEFAULT: '#0D0020',
          foreground: '#ffffff',
        },
      },
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, #836EF9, #5A4AB0)',
        'gradient-hero': 'linear-gradient(180deg, #08000F 0%, #0D0020 100%)',
        'gradient-card': 'linear-gradient(135deg, #0D0020, #130025)',
        'glow-primary': 'radial-gradient(circle, rgba(131,110,249,0.15), transparent)',
      },
      boxShadow: {
        'glow-primary': '0 0 30px rgba(131,110,249,0.25)',
        'glow-success': '0 0 20px rgba(52,211,153,0.2)',
        card: '0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'Arial', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'monospace'],
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config
