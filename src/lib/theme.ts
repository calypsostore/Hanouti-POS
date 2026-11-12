export interface AccentPalette {
  id: string
  name: string
  shades: { 50: string; 100: string; 500: string; 600: string; 700: string }
  darkShades: { 50: string; 100: string; 500: string; 600: string; 700: string }
  foreground: string
  darkForeground: string
}

export const accentPalettes: AccentPalette[] = [
  {
    id: '7anouti',
    name: '7anouti',
    shades: { 50: '#fff4db', 100: '#ffecb5', 500: '#f8a81a', 600: '#e39508', 700: '#c97f00' },
    darkShades: { 50: '#1c2842', 100: '#273957', 500: '#ffdc9a', 600: '#ffd078', 700: '#ffc14d' },
    foreground: '#754a00',
    darkForeground: '#ffd078',
  },
  {
    id: 'caramel',
    name: 'Caramel',
    shades: { 50: '#fbf3ec', 100: '#f6e4d3', 500: '#b4652f', 600: '#a0541f', 700: '#86451a' },
    darkShades: { 50: '#1c2842', 100: '#273957', 500: '#f1c09a', 600: '#e9ab7c', 700: '#df955f' },
    foreground: '#86451a',
    darkForeground: '#df955f',
  },
  {
    id: 'olive',
    name: 'Olive',
    shades: { 50: '#f2f7f1', 100: '#e0ecdc', 500: '#4c7a45', 600: '#3f6839', 700: '#34552f' },
    darkShades: { 50: '#1c2842', 100: '#273957', 500: '#bad9b4', 600: '#a4cd9d', 700: '#8fc186' },
    foreground: '#34552f',
    darkForeground: '#8fc186',
  },
  {
    id: 'ocean',
    name: 'Ocean',
    shades: { 50: '#eff6fa', 100: '#d9eaf3', 500: '#2c7794', 600: '#22647e', 700: '#1b5266' },
    darkShades: { 50: '#1c2842', 100: '#273957', 500: '#a8d7e8', 600: '#8dc9df', 700: '#73bad5' },
    foreground: '#1b5266',
    darkForeground: '#73bad5',
  },
  {
    id: 'plum',
    name: 'Plum',
    shades: { 50: '#f8f2f8', 100: '#efdfef', 500: '#8a4b86', 600: '#753d72', 700: '#5f315d' },
    darkShades: { 50: '#1c2842', 100: '#273957', 500: '#ddb8db', 600: '#d2a2cf', 700: '#c68ec2' },
    foreground: '#5f315d',
    darkForeground: '#c68ec2',
  },
  {
    id: 'clay',
    name: 'Clay',
    shades: { 50: '#fbf1ef', 100: '#f6ded9', 500: '#b5533f', 600: '#9c4534', 700: '#833a2b' },
    darkShades: { 50: '#1c2842', 100: '#273957', 500: '#eab5aa', 600: '#e29f92', 700: '#d98879' },
    foreground: '#833a2b',
    darkForeground: '#d98879',
  },
  {
    id: 'graphite',
    name: 'Graphite',
    shades: { 50: '#f4f4f5', 100: '#e4e4e7', 500: '#52525b', 600: '#3f3f46', 700: '#2f2f35' },
    darkShades: { 50: '#1c2842', 100: '#273957', 500: '#d4d4d8', 600: '#c4c4cb', 700: '#b0b0ba' },
    foreground: '#2f2f35',
    darkForeground: '#b0b0ba',
  },
]

export function applyAccent(paletteId: string) {
  const palette = accentPalettes.find((p) => p.id === paletteId) ?? accentPalettes[0]
  const shades = document.documentElement.classList.contains('dark') ? palette.darkShades : palette.shades
  const root = document.documentElement
  root.style.setProperty('--color-accent-50', shades[50])
  root.style.setProperty('--color-accent-100', shades[100])
  root.style.setProperty('--color-accent-500', shades[500])
  root.style.setProperty('--color-accent-600', shades[600])
  root.style.setProperty('--color-accent-700', shades[700])
  root.style.setProperty(
    '--color-accent-foreground',
    document.documentElement.classList.contains('dark') ? palette.darkForeground : palette.foreground,
  )
}

export type ColorMode = 'light' | 'dark'
export const COLOR_MODE_KEY = '7anouti.color-mode'

export function readColorMode(): ColorMode {
  try {
    return localStorage.getItem(COLOR_MODE_KEY) === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

export function applyColorMode(mode: ColorMode) {
  document.documentElement.classList.toggle('dark', mode === 'dark')
}
