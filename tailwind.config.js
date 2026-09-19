/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // 知树品牌色：以「生长」为意象的深青绿
        brand: {
          50: '#E1F5EE',
          100: '#9FE1CB',
          200: '#5DCAA5',
          400: '#1D9E75',
          600: '#0F6E56',
          800: '#085041',
          900: '#04342C',
        },
        ink: {
          900: '#2C2C2A',
          700: '#444441',
          600: '#5F5E5A',
          400: '#888780',
        },
        // 掌握度色阶：红 → 黄 → 绿
        mastery: {
          gap: '#E24B4A',
          weak: '#EF9F27',
          ok: '#97C459',
          solid: '#0F6E56',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          '"PingFang SC"',
          '"Hiragino Sans GB"',
          '"Microsoft YaHei"',
          'sans-serif',
        ],
        mono: ['"JetBrains Mono"', 'Consolas', 'monospace'],
      },
      borderRadius: {
        card: '14px',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'dash-flow': {
          '0%': { strokeDashoffset: '24' },
          '100%': { strokeDashoffset: '0' },
        },
      },
      animation: {
        'fade-up': 'fade-up 320ms ease-out both',
        'dash-flow': 'dash-flow 900ms linear infinite',
      },
    },
  },
  plugins: [],
};
