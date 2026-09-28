const brlFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const brlShort = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

export const brl = (n: number) => brlFmt.format(n)
export const brl0 = (n: number) => brlShort.format(n)

export const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
export const dayKey = (d: Date) => `${monthKey(d)}-${String(d.getDate()).padStart(2, '0')}`

export function monthLabel(key: string, withYear = false) {
  const [y, m] = key.split('-').map(Number)
  const name = cap(MONTHS[m - 1])
  return withYear || y !== new Date().getFullYear() ? `${name} ${y}` : name
}

export function shiftMonth(key: string, delta: number) {
  const [y, m] = key.split('-').map(Number)
  return monthKey(new Date(y, m - 1 + delta, 1))
}

export function daysInMonth(key: string) {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

export function dayLabel(key: string) {
  const today = new Date()
  const yesterday = new Date(Date.now() - 86400000)
  if (key === dayKey(today)) return 'Hoje'
  if (key === dayKey(yesterday)) return 'Ontem'
  const [y, m, d] = key.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const base = `${cap(WEEKDAYS[date.getDay()])}, ${d} de ${MONTHS[m - 1]}`
  return y !== today.getFullYear() ? `${base} de ${y}` : base
}

export const timeLabel = (iso: string) =>
  new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

// Valor para <input type="date"> no fuso local
export const toDateInput = (d: Date) => dayKey(d)

export function greeting() {
  const h = new Date().getHours()
  return h < 5 ? 'Boa noite' : h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
}

export const METHODS: Array<{ id: string; label: string }> = [
  { id: 'pix', label: 'Pix' },
  { id: 'credito', label: 'Crédito' },
  { id: 'debito', label: 'Débito' },
  { id: 'dinheiro', label: 'Dinheiro' },
  { id: 'boleto', label: 'Boleto' },
  { id: 'transferencia', label: 'TED' },
]
export const methodLabel = (id: string | null) => METHODS.find((m) => m.id === id)?.label ?? null

export function haptic(ms = 8) {
  try {
    navigator.vibrate?.(ms)
  } catch {
    /* iOS não suporta; ignorado */
  }
}
