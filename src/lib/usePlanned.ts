import { useMemo } from 'react'
import { useStore, type Tx } from './store'
import { addMonths, occurrencesInMonth, paidIndex, monthStart, type Occurrence } from './planned'
import { computeLookahead, type CashEvent } from './lookahead'
import { daysInMonth, dayKey, monthKey } from './format'
import { computeAllowance, type Allowance } from './allowance'

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

// Puladas não contam no previsto; possíveis em aberto também não (só se acontecerem)
export function summarize(occ: Occurrence[], kind: 'expense' | 'income'): PlanSummary {
  const s: PlanSummary = { total: 0, paid: 0, open: 0, openCount: 0 }
  for (const o of occ) {
    if (o.planned.kind !== kind || o.skipped) continue
    if (o.planned.tentative && !o.paid) continue
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
  allowance: Allowance
  goal: number
  // Cenário com os valores possíveis (não garantidos) dos próximos 6 meses
  possible: {
    inflow: number
    outflow: number
    perDay: number | null
    firstNegative: { date: Date; balance: number } | null
    path: Array<{ date: Date; balance: number }>
  } | null
  accountBalance: number | null // saldo em conta agora (informado + lançamentos depois)
}

// Previsão do mês: o que já saiu + contas em aberto + ritmo dos gastos do dia a dia (sem as contas)
export function useForecast(month: string): Forecast {
  const { txs, profile, planned } = useStore()
  const occ = useOccurrences(month)
  const goal = profile?.savings_goal ?? 0
  const accountBalance = useAccountBalance()
  return useMemo(() => {
    const now = new Date()
    const current = monthKey(now)
    const phase = month < current ? 'past' : month > current ? 'future' : 'current'
    let spent = 0
    let received = 0
    let spentVariable = 0
    let spentVariableToday = 0
    let reserved = 0
    const today = dayKey(now)
    for (const t of txs) {
      const d = new Date(t.occurred_at)
      // Conta ligada a um previsto pertence ao mês dele (salário do dia 1º que caiu no dia 30 é do mês seguinte)
      const txMonth = t.planned_month ? t.planned_month.slice(0, 7) : monthKey(d)
      if (t.kind === 'income' && t.planned_month && txMonth > current && monthKey(d) <= current) reserved += t.amount
      if (txMonth !== month) continue
      if (t.kind === 'income') {
        received += t.amount
        continue
      }
      spent += t.amount
      if (!t.planned_id) {
        spentVariable += t.amount
        if (dayKey(d) === today) spentVariableToday += t.amount
      }
    }
    const exp = summarize(occ, 'expense')
    const inc = summarize(occ, 'income')
    const billsOpen = phase === 'past' ? 0 : exp.open
    const incomeOpen = phase === 'past' ? 0 : inc.open
    const days = daysInMonth(month)
    const elapsed = phase === 'current' ? now.getDate() : days
    const variableAhead = phase === 'current' ? (spentVariable / elapsed) * (days - elapsed) : 0
    const willSpend = spent + billsOpen + Math.max(0, variableAhead)
    const willReceive = received + incomeOpen
    let possible: Forecast['possible'] = null
    let allowance = computeAllowance({
      phase,
      days,
      day: now.getDate(),
      spent,
      spentVariable,
      spentVariableToday,
      received,
      billsOpen,
      incomeOpen,
      goal,
      available: accountBalance,
      reserved,
    })

    // Mês atual: o disponível por dia olha os próximos 6 meses, conta a conta na data dela
    if (phase === 'current' && allowance.verdict !== 'no-balance') {
      const paid = paidIndex(txs)
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const events: CashEvent[] = []
      const possibleEvents: CashEvent[] = []
      const monthEnds: Date[] = []
      for (let k = 0; k < 6; k++) {
        const m = addMonths(month, k)
        const [y, mm] = m.split('-').map(Number)
        const end = new Date(y, mm, 0)
        monthEnds.push(end)
        if (goal > 0) events.push({ date: end, amount: -goal, label: 'Meta de economia', goal: true })
        for (const o of occurrencesInMonth(planned, m, paid)) {
          if (o.paid || o.skipped) continue
          // Receita atrasada não conta (pode já ter caído sem registro); conta atrasada vence hoje
          if (o.planned.kind === 'income' && o.due < todayStart) continue
          const ev = { date: o.due, amount: o.planned.kind === 'income' ? o.amount : -o.amount, label: o.label }
          if (o.planned.tentative) possibleEvents.push(ev)
          else events.push(ev)
        }
      }
      const look = computeLookahead({
        today: now,
        cash: allowance.cash,
        spentToday: spentVariableToday,
        pace: allowance.pace,
        events,
        monthEnds,
      })
      if (possibleEvents.length) {
        const withPossible = computeLookahead({
          today: now,
          cash: allowance.cash,
          spentToday: spentVariableToday,
          pace: allowance.pace,
          events: [...events, ...possibleEvents],
          monthEnds,
        })
        possible = {
          inflow: possibleEvents.filter((e) => e.amount > 0).reduce((s, e) => s + e.amount, 0),
          outflow: possibleEvents.filter((e) => e.amount < 0).reduce((s, e) => s - e.amount, 0),
          perDay: withPossible.perDay,
          firstNegative: withPossible.firstNegative,
          path: withPossible.path,
        }
      }
      const perDay = look.perDay
      allowance = {
        ...allowance,
        perDay,
        free: look.binding.available,
        daysLeft: look.binding.days,
        leftToday: Math.max(0, perDay - spentVariableToday),
        cutPerDay: Math.max(0, allowance.pace - perDay),
        reserved: 0,
        verdict: perDay <= 0 ? 'broke' : allowance.pace > perDay ? 'red' : allowance.pace > perDay * 0.8 ? 'yellow' : 'green',
        binding: look.binding,
        firstNegative: look.firstNegative,
        horizonEnd: look.horizonEnd,
        path: look.path,
      }
    }

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
      goal,
      accountBalance,
      allowance,
      possible,
    }
  }, [txs, occ, month, goal, accountBalance, planned])
}

// Saldo em conta: o valor informado pelo usuário + o que entrou - o que saiu depois disso
export function useAccountBalance(): number | null {
  const { txs, profile } = useStore()
  return useMemo(() => {
    if (profile?.balance_amount == null || !profile.balance_at) return null
    const since = new Date(profile.balance_at).getTime()
    let bal = profile.balance_amount
    for (const t of txs) {
      if (new Date(t.occurred_at).getTime() <= since) continue
      bal += t.kind === 'income' ? t.amount : -t.amount
    }
    return bal
  }, [txs, profile?.balance_amount, profile?.balance_at])
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
