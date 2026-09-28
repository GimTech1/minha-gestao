import type { Category, Tx } from './store'
import { dayKey, monthKey } from './format'

export const txMonth = (t: Tx) => monthKey(new Date(t.occurred_at))

export function monthTxs(txs: Tx[], key: string) {
  return txs.filter((t) => txMonth(t) === key)
}

export function totals(txs: Tx[]) {
  let expense = 0
  let income = 0
  for (const t of txs) {
    if (t.kind === 'expense') expense += t.amount
    else income += t.amount
  }
  return { expense, income, balance: income - expense }
}

export interface CatTotal {
  id: string
  name: string
  emoji: string
  color: string
  total: number
  count: number
}

export function byCategory(txs: Tx[], catById: Map<string, Category>, kind: 'expense' | 'income' = 'expense'): CatTotal[] {
  const map = new Map<string, CatTotal>()
  for (const t of txs) {
    if (t.kind !== kind) continue
    const c = t.category_id ? catById.get(t.category_id) : undefined
    const id = c?.id ?? 'none'
    const cur = map.get(id) ?? { id, name: c?.name ?? 'Sem categoria', emoji: c?.emoji ?? '❔', color: c?.color ?? '#8b8b9e', total: 0, count: 0 }
    cur.total += t.amount
    cur.count++
    map.set(id, cur)
  }
  return [...map.values()].sort((a, b) => b.total - a.total)
}

export function spentSince(txs: Tx[], from: Date) {
  const iso = from.toISOString()
  return txs.reduce((s, t) => (t.kind === 'expense' && t.occurred_at >= iso ? s + t.amount : s), 0)
}

export function dailyExpense(txs: Tx[], key: string, days: number) {
  const arr = Array.from({ length: days }, () => 0)
  for (const t of txs) {
    if (t.kind !== 'expense') continue
    const k = dayKey(new Date(t.occurred_at))
    if (k.startsWith(key)) arr[Number(k.slice(8)) - 1] += t.amount
  }
  return arr
}

export function startOfWeek(d = new Date()) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7)) // segunda-feira
  return x
}
