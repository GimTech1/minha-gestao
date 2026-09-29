// Projeção dos próximos meses: entradas e contas previstas + gastos do dia a dia estimados,
// com o saldo de cada mês e o acumulado desde o mês atual.
import { addMonths, occurrencesInMonth, type Occurrence, type PaidRef, type Planned } from './planned.ts'

export interface MonthProjection {
  month: string
  income: number
  bills: number
  variable: number
  balance: number
  cumulative: number
  occ: Occurrence[]
}

export interface ProjectionInput {
  planned: Planned[]
  paid: Map<string, PaidRef>
  // Mês atual já vem calculado pela previsão do Início (inclui o que já entrou e saiu)
  current: { month: string; willReceive: number; bills: number; variable: number }
  variablePerMonth: number
  horizon: number // quantos meses, contando o atual
  includeVariable: boolean
  start?: number // saldo em conta hoje: o acumulado vira "quanto vou ter na conta"
  includePossible?: boolean // soma também os valores possíveis (não garantidos)
}

export function projectMonths(i: ProjectionInput): MonthProjection[] {
  const rows: MonthProjection[] = []
  let cumulative = i.start ?? 0
  for (let k = 0; k < i.horizon; k++) {
    const month = addMonths(i.current.month, k)
    const occ = occurrencesInMonth(i.planned, month, i.paid).filter((o) => !o.skipped && (i.includePossible || !o.planned.tentative || o.paid))
    let income: number
    let bills: number
    let variable: number
    if (k === 0) {
      // Mês atual vem da previsão (só garantidos); os possíveis em aberto somam à parte
      const extra = i.includePossible ? occ.filter((o) => o.planned.tentative && !o.paid) : []
      income = i.current.willReceive + extra.filter((o) => o.planned.kind === 'income').reduce((s, o) => s + o.amount, 0)
      bills = i.current.bills + extra.filter((o) => o.planned.kind === 'expense').reduce((s, o) => s + o.amount, 0)
      variable = i.includeVariable ? i.current.variable : 0
    } else {
      income = occ.filter((o) => o.planned.kind === 'income').reduce((s, o) => s + o.amount, 0)
      bills = occ.filter((o) => o.planned.kind === 'expense').reduce((s, o) => s + o.amount, 0)
      variable = i.includeVariable ? i.variablePerMonth : 0
    }
    const balance = income - bills - variable
    cumulative += balance
    rows.push({ month, income, bills, variable, balance, cumulative, occ })
  }
  return rows
}

// Média mensal dos gastos do dia a dia (sem contas previstas) nos últimos meses completos;
// sem histórico, usa o ritmo do mês atual projetado para 30 dias.
export function estimateVariablePerMonth(
  txs: Array<{ kind: string; amount: number; occurred_at: string; planned_id?: string | null }>,
  currentMonth: string,
  currentPacePerDay: number,
  lookback = 3,
) {
  const months = Array.from({ length: lookback }, (_, k) => addMonths(currentMonth, -(k + 1)))
  const totals = new Map(months.map((m) => [m, 0]))
  for (const t of txs) {
    if (t.kind !== 'expense' || t.planned_id) continue
    const d = new Date(t.occurred_at)
    const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (totals.has(m)) totals.set(m, totals.get(m)! + t.amount)
  }
  const withData = [...totals.values()].filter((v) => v > 0)
  if (withData.length) return withData.reduce((s, v) => s + v, 0) / withData.length
  return currentPacePerDay * 30
}
