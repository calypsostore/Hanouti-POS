export interface AccentPalette {
  id: string
  name: string
  shades: { 50: string; 100: string; 500: string; 600: string; 700: string }
}

export const accentPalettes: AccentPalette[] = [
  {
    id: 'caramel',
    name: 'Caramel',
    shades: { 50: '#fbf3ec', 100: '#f6e4d3', 500: '#b4652f', 600: '#a0541f', 700: '#86451a' },
  },
  {
    id: 'olive',
    name: 'Olive',
    shades: { 50: '#f2f7f1', 100: '#e0ecdc', 500: '#4c7a45', 600: '#3f6839', 700: '#34552f' },
  },
  {
    id: 'ocean',
    name: 'Ocean',
    shades: { 50: '#eff6fa', 100: '#d9eaf3', 500: '#2c7794', 600: '#22647e', 700: '#1b5266' },
  },
  {
    id: 'plum',
    name: 'Plum',
    shades: { 50: '#f8f2f8', 100: '#efdfef', 500: '#8a4b86', 600: '#753d72', 700: '#5f315d' },
  },
  {
    id: 'clay',
    name: 'Clay',
    shades: { 50: '#fbf1ef', 100: '#f6ded9', 500: '#b5533f', 600: '#9c4534', 700: '#833a2b' },
  },
  {
    id: 'graphite',
    name: 'Graphite',
    shades: { 50: '#f4f4f5', 100: '#e4e4e7', 500: '#52525b', 600: '#3f3f46', 700: '#2f2f35' },
  },
]

export function applyAccent(paletteId: string) {
  const palette = accentPalettes.find((p) => p.id === paletteId) ?? accentPalettes[0]
  const root = document.documentElement
  root.style.setProperty('--color-accent-50', palette.shades[50])
  root.style.setProperty('--color-accent-100', palette.shades[100])
  root.style.setProperty('--color-accent-500', palette.shades[500])
  root.style.setProperty('--color-accent-600', palette.shades[600])
  root.style.setProperty('--color-accent-700', palette.shades[700])
}
