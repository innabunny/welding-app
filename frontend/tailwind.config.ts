import type { Config } from 'tailwindcss'
import plugin from 'tailwindcss/plugin.js'

// Палитра из dashboard.html — согласованный эталон, значения не менять
// без правки эталона. Ключи совпадают с CSS-переменными макета.
const light = {
  bg: '#f4f7f9',
  surface: '#ffffff',
  'surface-2': '#eef3f6',
  border: '#dce4e9',
  text: '#1b2933',
  muted: '#61727c',
  primary: '#256b8f',
  'primary-hover': '#1d5b7a',
  'primary-soft': '#e8f2f6',
  teal: '#2a8c8a',
  success: '#24785a',
  'success-soft': '#e3f2ec',
  warning: '#a8701c',
  'warning-soft': '#fbf0dd',
  danger: '#b34242',
  'danger-soft': '#fae9e9',
} as const

type ColorName = keyof typeof light

const dark: Record<ColorName, string> = {
  bg: '#0e1820',
  surface: '#15232d',
  'surface-2': '#1b2c38',
  border: '#29404d',
  text: '#e8eff2',
  muted: '#9bb0bb',
  primary: '#5ba0c2',
  'primary-hover': '#6fb2d2',
  'primary-soft': '#193341',
  teal: '#49a5a1',
  success: '#4fb98d',
  'success-soft': '#16332a',
  warning: '#d9a24e',
  'warning-soft': '#362a16',
  danger: '#e07a7a',
  'danger-soft': '#3a2020',
}

const shadow = {
  light: '0 10px 30px rgba(22, 43, 58, .06)',
  dark: '0 14px 34px rgba(0, 0, 0, .18)',
}

const colorNames = Object.keys(light) as ColorName[]

// каналы через пробел — чтобы работали модификаторы прозрачности (bg-success/40)
function channels(hex: string): string {
  const n = Number.parseInt(hex.slice(1), 16)
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`
}

function themeVars(palette: Record<ColorName, string>, cardShadow: string) {
  const vars: Record<string, string> = { '--shadow-card': cardShadow }
  for (const name of colorNames) vars[`--c-${name}`] = channels(palette[name])
  return vars
}

const colors = Object.fromEntries(
  colorNames.map((name) => [name, `rgb(var(--c-${name}) / <alpha-value>)`]),
)

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    // брейкпоинты макета: 480 — телефон, 760 — меню сбоку, 1080 — две колонки
    screens: {
      sm: '480px',
      md: '760px',
      lg: '1080px',
    },
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      white: '#ffffff',
      ...colors,
    },
    // не меньше 12px: интерфейс смотрят с расстояния
    fontSize: {
      xs: ['12px', '1.45'],
      caption: ['12.5px', '1.45'],
      sm: ['13px', '1.45'],
      nav: ['13.5px', '1.45'],
      base: ['14px', '1.45'],
      lg: ['15px', '1.4'],
      xl: ['22px', '1.25'],
      '2xl': ['26px', '1.2'],
      '3xl': ['30px', '1.15'],
    },
    borderRadius: {
      none: '0',
      tag: '6px',
      sm: '8px',
      control: '10px',
      tile: '11px',
      box: '12px',
      card: '16px',
      full: '9999px',
    },
    boxShadow: {
      none: 'none',
      card: 'var(--shadow-card)',
    },
    fontFamily: {
      sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', '"Segoe UI"', 'sans-serif'],
      mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
    },
    extend: {
      fontWeight: { heading: '650' },
      letterSpacing: { heading: '-.02em', number: '-.03em' },
      maxWidth: { content: '1380px' },
      width: { sidebar: '252px' },
      height: { topbar: '64px' },
      gridTemplateColumns: { app: '252px minmax(0, 1fr)' },
    },
  },
  plugins: [
    plugin(({ addBase }) => {
      addBase({
        ':root': { ...themeVars(light, shadow.light), colorScheme: 'light' },
        '[data-theme="dark"]': { ...themeVars(dark, shadow.dark), colorScheme: 'dark' },
      })
    }),
  ],
} satisfies Config
