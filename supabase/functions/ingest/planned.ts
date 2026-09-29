// Contas previstas: gera as ocorrências de cada mês a partir das regras (todo mês, parcelado, uma vez)
// e casa lançamentos reais com a ocorrência que eles pagam.
// Sem dependências: o mesmo arquivo roda no app (Vite) e na Edge Function (Deno).

export type PlanType = 'monthly' | 'installments' | 'once'

export interface Planned {
  id: string
  kind: 'expense' | 'income'
  amount: number
  description: string
  category_id: string | null
  method: string | null
  type: PlanType
  day: number
  start_month: string // 'YYYY-MM-01'
  installments: number | null
  end_month: string | null // último mês incluído, 'YYYY-MM-01'
  skipped_months: string[]
}

// O mínimo de um lançamento para saber se pagou alguma ocorrência
export interface PaidRef {
  id: string
  planned_id?: string | null
  planned_month?: string | null
  amount: number
}

export interface Occurrence {
  planned: Planned
  month: string // 'YYYY-MM'
  due: Date
  dueKey: string // 'YYYY-MM-DD'
  amount: number
  label: string
  index: number | null
  total: number | null
  paid: PaidRef | null
  skipped: boolean
}

export type OccStatus = 'paid' | 'skipped' | 'overdue' | 'today' | 'upcoming'

const pad = (n: number) => String(n).padStart(2, '0')
const ym = (s: string) => s.slice(0, 7)
const monthIdx = (key: string) => {
  const [y, m] = key.split('-').map(Number)
  return y * 12 + (m - 1)
}
const norm = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

export const monthOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
export const dayOf = (d: Date) => `${monthOf(d)}-${pad(d.getDate())}`
export const monthStart = (month: string) => `${month}-01`
export const monthsBetween = (from: string, to: string) => monthIdx(ym(to)) - monthIdx(ym(from))

export function addMonths(month: string, delta: number) {
  const [y, m] = month.split('-').map(Number)
  return monthOf(new Date(y, m - 1 + delta, 1))
}

// Dia 31 em fevereiro vira o último dia do mês
export function dueDate(month: string, day: number) {
  const [y, m] = month.split('-').map(Number)
  const last = new Date(y, m, 0).getDate()
  return new Date(y, m - 1, Math.min(day, last))
}

export const paidKey = (plannedId: string, month: string) => `${plannedId}|${ym(month)}`

export function paidIndex(txs: PaidRef[]) {
  const map = new Map<string, PaidRef>()
  for (const t of txs) if (t.planned_id && t.planned_month) map.set(paidKey(t.planned_id, t.planned_month), t)
  return map
}

export function occurrenceFor(p: Planned, month: string, paid: Map<string, PaidRef> = new Map()): Occurrence | null {
  const start = monthIdx(ym(p.start_month))
  const cur = monthIdx(month)
  if (cur < start) return null
  if (p.end_month && cur > monthIdx(ym(p.end_month))) return null
  if (p.type === 'once' && cur !== start) return null
  let index: number | null = null
  let total: number | null = null
  if (p.type === 'installments') {
    index = cur - start + 1
    total = p.installments ?? 1
    if (index > total) return null
  }
  const due = dueDate(month, p.day)
  return {
    planned: p,
    month,
    due,
    dueKey: dayOf(due),
    amount: p.amount,
    label: index ? `${p.description} (${index}/${total})` : p.description,
    index,
    total,
    paid: paid.get(paidKey(p.id, month)) ?? null,
    skipped: p.skipped_months.some((s) => ym(s) === month),
  }
}

export function occurrencesInMonth(planned: Planned[], month: string, paid: Map<string, PaidRef> = new Map()) {
  return planned
    .map((p) => occurrenceFor(p, month, paid))
    .filter((o): o is Occurrence => !!o)
    .sort((a, b) => a.due.getTime() - b.due.getTime() || a.label.localeCompare(b.label))
}

export function occStatus(o: Occurrence, today = new Date()): OccStatus {
  if (o.paid) return 'paid'
  if (o.skipped) return 'skipped'
  const t = dayOf(today)
  if (o.dueKey < t) return 'overdue'
  if (o.dueKey === t) return 'today'
  return 'upcoming'
}

// Em aberto para casar com um pagamento: o mês atual, atrasadas do mês anterior
// e as do mês seguinte que vencem em até 5 dias (salário do dia 1º que cai no dia 30/31)
export function openOccurrences(planned: Planned[], paid: Map<string, PaidRef>, today = new Date()) {
  const month = monthOf(today)
  const prev = addMonths(month, -1)
  const next = addMonths(month, 1)
  const soon = today.getTime() + 5 * 86400000
  return [
    ...occurrencesInMonth(planned, prev, paid).filter((o) => occStatus(o, today) === 'overdue'),
    ...occurrencesInMonth(planned, month, paid).filter((o) => !o.paid && !o.skipped),
    ...occurrencesInMonth(planned, next, paid).filter((o) => !o.paid && !o.skipped && o.due.getTime() <= soon),
  ]
}

const words = (s: string) => new Set(norm(s).split(/[^a-z0-9]+/).filter((w) => w.length >= 3))

// Casa um lançamento com a conta prevista que ele provavelmente paga:
// mesmo tipo, valor igual (tolerância de 1%) e (nome parecido, vencimento a até 5 dias,
// ou conta atrasada com o valor exato ao centavo).
export function findMatch(
  planned: Planned[],
  paid: Map<string, PaidRef>,
  kind: 'expense' | 'income',
  amount: number,
  text: string,
  today = new Date(),
): Occurrence | null {
  const tw = words(text)
  const scored = openOccurrences(planned, paid, today)
    .filter((o) => o.planned.kind === kind && Math.abs(o.amount - amount) <= Math.max(0.01, o.amount * 0.01))
    .map((o) => ({
      o,
      overlap: [...words(o.planned.description)].some((w) => tw.has(w)),
      days: Math.abs(o.due.getTime() - today.getTime()) / 86400000,
      lateExact: occStatus(o, today) === 'overdue' && Math.abs(o.amount - amount) < 0.005,
    }))
    .filter((s) => s.overlap || s.days <= 5 || s.lateExact)
    .sort((a, b) => Number(b.overlap) - Number(a.overlap) || a.days - b.days)
  return scored[0]?.o ?? null
}

export function describePlan(p: Planned) {
  if (p.type === 'monthly') return `Todo mês · dia ${p.day}`
  if (p.type === 'installments') return `${p.installments}x · dia ${p.day}`
  return `Uma vez · dia ${p.day}`
}
