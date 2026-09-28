import { useMemo } from 'react'
import { useStore, type Tx } from './store'
import { occurrencesInMonth, paidIndex, monthStart, type Occurrence } from './planned'
import { daysInMonth, monthKey } from './format'

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

export interface Forecast {
  phase: 'past' | 'current' | 'future'
  spent: number
  received: number
  balanceNow: number
  billsOpen: number // contas previstas a pagar ainda em aberto
  incomeOpen: number // previstos a receber em aberto
  variableAhead: number // gastos do dia a dia esperados nos dias que faltam, no ritmo atual
  willSpend: number
  willReceive: number
  endBalance: number
}

// Previsão do mês: o que já saiu + contas em aberto + ritmo dos gastos do dia a dia (sem as contas)
export function useForecast(month: string): Forecast {
  const { txs } = useStore()
  const occ = useOccurrences(month)
  return useMemo(() => {
    const now = new Date()
    const current = monthKey(now)
    const phase = month < current ? 'past' : month > current ? 'future' : 'current'
    let spent = 0
    let received = 0
    for (const t of txs) {
      if (monthKey(new Date(t.occurred_at)) !== month) continue
      if (t.kind === 'expense') spent += t.amount
      else received += t.amount
    }
    const exp = summarize(occ, 'expense')
    const inc = summarize(occ, 'income')
    const billsOpen = phase === 'past' ? 0 : exp.open
    const incomeOpen = phase === 'past' ? 0 : inc.open
    const days = daysInMonth(month)
    const elapsed = phase === 'current' ? now.getDate() : days
    const variableAhead = phase === 'current' ? ((spent - exp.paid) / elapsed) * (days - elapsed) : 0
    const willSpend = spent + billsOpen + Math.max(0, variableAhead)
    const willReceive = received + incomeOpen
    return {
      phase,
      spent,
      received,
      balanceNow: received - spent,
      billsOpen,
      incomeOpen,
      variableAhead: Math.max(0, variableAhead),
      willSpend,
      willReceive,
      endBalance: willReceive - willSpend,
    }
  }, [txs, occ, month])
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
