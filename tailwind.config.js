/** Light pastel theme, sampled from Bunini Loves' poster style: bubblegum pink, cloud blue, star yellow, dark-plum outlines. */
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // "ink" is now a semantic scale: 950 = text & outline, 900 = page, 800 = card surface, 700-500 = tinted fills/borders
        ink: { 950: '#2b1a2e', 900: '#ffe9f2', 800: '#ffffff', 700: '#ffdcea', 600: '#f7c9dc', 500: '#e8b3c9' },
        // Accent (user-mandated #ffe566). Used as fills, with dark text/outline on top.
        sun: '#ffe566', // decorative fill (same as star)
        // Darker yellow for yellow-coloured icons/text on light backgrounds so they stay visible. "gold" = icons/doodles, "gold-text" = small text (AA contrast).
        gold: { DEFAULT: '#d49a00', text: '#8a6700' },
        star: { DEFAULT: '#ffe566', soft: '#fff2a8', deep: '#f2cd2e' },
        // Poster pink. "ribbon" is the readable deep pink used for text on light backgrounds.
        bun: { DEFAULT: '#ffb8d9', soft: '#ffd6e8', deep: '#f0508c', ribbon: '#d93a78' },
        // Poster cloud blue
        cloud: { DEFAULT: '#b9d7f5', soft: '#dcebfa', deep: '#6fa6e0' },
        milk: '#2b1a2e', // body text colour (name kept so existing classes keep working)
      },
      fontFamily: {
        display: ['Fredoka', 'ui-rounded', 'system-ui', 'sans-serif'],
        sans: ['Nunito', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: { '4xl': '2rem' },
      boxShadow: {
        glow: '3px 3px 0 0 #2b1a2e',
        card: '3px 3px 0 0 rgba(43,26,46,.9)',
        sticker: '4px 4px 0 0 #2b1a2e',
        soft: '0 10px 30px -12px rgba(217,58,120,.35)',
      },
      keyframes: {
        floaty: { '0%,100%': { transform: 'translateY(0) rotate(0)' }, '50%': { transform: 'translateY(-8px) rotate(3deg)' } },
        twinkle: { '0%,100%': { opacity: '.55', transform: 'scale(.9) rotate(-4deg)' }, '50%': { opacity: '1', transform: 'scale(1.1) rotate(5deg)' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        pop: { '0%': { transform: 'scale(1)' }, '40%': { transform: 'scale(1.25)' }, '100%': { transform: 'scale(1)' } },
      },
      animation: {
        floaty: 'floaty 6s ease-in-out infinite',
        twinkle: 'twinkle 3s ease-in-out infinite',
        shimmer: 'shimmer 1.6s infinite',
        pop: 'pop .35s ease-out',
      },
    },
  },
  plugins: [],
}
