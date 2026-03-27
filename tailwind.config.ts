import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // X 精确配色
        x: {
          bg: '#000000',
          'bg-secondary': '#16181C',
          'bg-hover': '#1C1F23',
          border: '#2F3336',
          'text-primary': '#E7E9EA',
          'text-secondary': '#71767B',
          blue: '#1D9BF0',
          'blue-hover': '#1A8CD8',
          red: '#F91880',
          green: '#00BA7C',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto',
          'PingFang SC', 'Microsoft YaHei', 'sans-serif'
        ],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
}
export default config
