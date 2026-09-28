import type { Config } from 'tailwindcss';

/** KEEYSTAY tokens. Light: ivory/charcoal. Dark: near-black panels, bright saturated accents. */
export default {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ivory:  { 50: '#faf9f7', 100: '#f4f2ef', 200: '#efedea' },
        ink:    { DEFAULT: '#1a1917', muted: '#6b6862', faint: '#9a968f' },
        rule:   { DEFAULT: '#e4e1dc', soft: '#efedea' },
        state: {
          ready:  '#15803d', readyBg:  '#e8f2ea',
          attend: '#a45c09', attendBg: '#faf0df',
          fault:  '#b3261e', faultBg:  '#fbeae8',
          info:   '#1f5f8b', infoBg:   '#e9f0f6',
        },
        /* Dark theme */
        night:  { 50: '#0c0d0f', 100: '#15161a', 200: '#1d1f24' },
        inkD:   { DEFAULT: '#f3f2ef', muted: '#a7a4a0', faint: '#6f6d6a' },
        ruleD:  { DEFAULT: '#2a2c31', soft: '#1f2126' },
        stateD: {
          ready:  '#4ade80', readyBg:  '#0f2e1c',
          attend: '#fbbf24', attendBg: '#3a2705',
          fault:  '#fb7185', faultBg:  '#3a1016',
          info:   '#38bdf8', infoBg:   '#0c2733',
        },
        /* KEEYSTAY booking-identity palette — for telling properties/bookings apart on the
           calendar. Same three hexes in both themes (brand accents, not status colors);
           each gets a paired low-opacity background generated via /NN opacity utilities
           at the call site rather than a separate *Bg token, since only 3 colors exist. */
        booking: { pink: '#E3226C', amber: '#E3A322', green: '#18C721' },
      },
      fontFamily: { sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui'] },
      fontSize: {
        micro: ['11px', { lineHeight: '14px', letterSpacing: '0.08em' }],
        meta:  ['12.5px', { lineHeight: '17px' }],
        body:  ['15px', { lineHeight: '22px' }],
        title: ['19px', { lineHeight: '25px', letterSpacing: '-0.015em' }],
        display: ['28px', { lineHeight: '33px', letterSpacing: '-0.02em' }],
      },
      borderRadius: { xs: '4px', sm: '6px', DEFAULT: '8px', lg: '12px', sheet: '14px' },
      boxShadow: {
        raise: '0 1px 2px rgba(26,25,23,0.05)',
        sheet: '0 -8px 32px rgba(26,25,23,0.12)',
        raiseD: '0 1px 2px rgba(0,0,0,0.4)',
        sheetD: '0 -8px 32px rgba(0,0,0,0.6)',
      },
      spacing: { gutter: '16px', rail: '152px' },
      transitionDuration: { fast: '120ms', sheet: '220ms' },
    },
  },
  plugins: [],
} satisfies Config;