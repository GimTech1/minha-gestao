import { useMemo } from 'react'
import { useStore, type Tx } from './store'
import { occurrencesInMonth, paidIndex, monthStart, type Occurrence } from './planned'

export function useOccurrences(month: string) {
  const { planned, txs } = useStore()
  const paid = useMemo(() => paidIndex(txs), [txs])
  return useMemo(() => occurrencesInMonth(planned, month, paid), [planned, month, paid])
}

export interface PlanSummary {
  total: number
  paid: number
  open: number
  openCount: number
}

// Puladas não contam no previsto
export function summarize(occ: Occurrence[], kind: 'expense' | 'income'): PlanSummary {
  const s: PlanSummary = { total: 0, paid: 0, open: 0, openCount: 0 }
  for (const o of occ) {
    if (o.planned.kind !== kind || o.skipped) continue
    s.total += o.paid ? o.paid.amount : o.amount
    if (o.paid) s.paid += o.paid.amount
    else {
      s.open += o.amount
      s.openCount++
    }
  }
  return s
}

// Lançamento que paga a ocorrência
export function paymentTx(o: Occurrence, amount = o.amount): Tx {
  return {
    id: crypto.randomUUID(),
    kind: o.planned.kind,
    amount,
    category_id: o.planned.category_id,
    description: o.label,
    method: o.planned.method,
    occurred_at: new Date().toISOString(),
    source: 'manual',
    planned_id: o.planned.id,
    planned_month: monthStart(o.month),
  }
}
