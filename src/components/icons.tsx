const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

export const IconHome = () => (
  <svg viewBox="0 0 24 24" {...base}><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" /></svg>
)
export const IconList = () => (
  <svg viewBox="0 0 24 24" {...base}><path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" /></svg>
)
export const IconChart = () => (
  <svg viewBox="0 0 24 24" {...base}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>
)
export const IconGear = () => (
  <svg viewBox="0 0 24 24" {...base}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </svg>
)
export const IconPlus = () => <svg viewBox="0 0 24 24" {...base} strokeWidth={2.6}><path d="M12 5v14M5 12h14" /></svg>
export const IconX = () => <svg viewBox="0 0 24 24" {...base} strokeWidth={2.4}><path d="M18 6 6 18M6 6l12 12" /></svg>
export const IconBack = () => <svg viewBox="0 0 24 24" {...base} strokeWidth={2.4}><path d="m15 18-6-6 6-6" /></svg>
export const IconNext = () => <svg viewBox="0 0 24 24" {...base} strokeWidth={2.4}><path d="m9 18 6-6-6-6" /></svg>
export const IconDel = () => (
  <svg viewBox="0 0 24 24" {...base}><path d="M21 5H9l-7 7 7 7h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1zM18 9l-6 6M12 9l6 6" /></svg>
)
export const IconTrash = () => (
  <svg viewBox="0 0 24 24" {...base}><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" /></svg>
)
export const IconSearch = () => <svg viewBox="0 0 24 24" {...base}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
export const IconClip = () => (
  <svg viewBox="0 0 24 24" {...base}><rect x="8" y="3" width="8" height="4" rx="1" /><path d="M16 5h2a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2" /></svg>
)
