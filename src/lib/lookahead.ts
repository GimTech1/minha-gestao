// Disponível por dia olhando para frente: o maior gasto diário que não deixa a conta negativa
// em nenhuma data futura, considerando cada conta e receita prevista na data dela.

export interface CashEvent {
  date: Date // dia do vencimento (sem hora)
  amount: number // + receita, − conta/meta
  label: string
  goal?: boolean // reserva da meta de economia (não é conta)
}

export interface Checkpoint {
  date: Date
  days: number // dias de gasto do dia a dia de hoje até a data (inclusive)
  available: number // dinheiro livre até a data sem gastos do dia a dia
  perDay: number
  inflow: number // receitas previstas até a data
  outflow: number // contas previstas até a data
  goals: number // metas de economia até a data
}

export interface Lookahead {
  perDay: number
  binding: Checkpoint // a data que limita o gasto diário
  checkpoints: Checkpoint[]
  // Mantendo a média diária atual: primeira data em que a conta fica negativa
  firstNegative: { date: Date; balance: number } | null
  horizonEnd: Date
  // Saldo previsto em conta em cada data, mantendo a média diária (para o gráfico)
  path: Array<{ date: Date; balance: number }>
}

const DAY = 86400000
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const daysBetween = (a: Date, b: Date) => Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / DAY)

export function computeLookahead(input: {
  today: Date
  cash: number // dinheiro disponível hoje (inclui o que já foi gasto hoje de volta, ver spentToday)
  spentToday: number // gasto do dia a dia de hoje: volta para o cálculo para o limite de hoje não encolher
  pace: number // média diária de gastos do dia a dia
  events: CashEvent[]
  monthEnds: Date[] // fins de mês do horizonte (pontos de checagem mesmo sem contas)
}): Lookahead {
  const today = startOfDay(input.today)
  const events = input.events
    .map((e) => ({ ...e, date: startOfDay(e.date) < today ? today : startOfDay(e.date) }))
    .sort((a, b) => a.date.getTime() - b.date.getTime())

  const dates = new Map<number, Date>()
  for (const e of events) {
    dates.set(e.date.getTime(), e.date)
    // Véspera de cada receita: não dá para gastar hoje o que só cai amanhã
    const eve = new Date(e.date.getTime() - DAY)
    if (e.amount > 0 && eve >= today) dates.set(startOfDay(eve).getTime(), startOfDay(eve))
  }
  for (const m of input.monthEnds) if (startOfDay(m) >= today) dates.set(startOfDay(m).getTime(), startOfDay(m))
  const sorted = [...dates.values()].sort((a, b) => a.getTime() - b.getTime())

  const base = input.cash + input.spentToday
  const checkpoints: Checkpoint[] = []
  let acc = 0
  let inflow = 0
  let outflow = 0
  let goals = 0
  let i = 0
  let firstNegative: Lookahead['firstNegative'] = null
  const path: Lookahead['path'] = [{ date: today, balance: input.cash }]
  for (const date of sorted) {
    while (i < events.length && events[i].date.getTime() <= date.getTime()) {
      const e = events[i++]
      acc += e.amount
      if (e.goal) goals -= e.amount
      else if (e.amount > 0) inflow += e.amount
      else outflow -= e.amount
    }
    const days = daysBetween(today, date) + 1
    const available = base + acc
    checkpoints.push({ date, days, available, perDay: available / days, inflow, outflow, goals })
    const withPace = available - input.pace * days
    path.push({ date, balance: available - input.spentToday - input.pace * (days - 1) })
    if (!firstNegative && withPace < 0) firstNegative = { date, balance: withPace }
  }

  const binding = checkpoints.reduce((m, c) => (c.perDay < m.perDay ? c : m), checkpoints[0])
  return {
    perDay: binding ? binding.perDay : 0,
    binding,
    checkpoints,
    firstNegative,
    horizonEnd: sorted[sorted.length - 1] ?? today,
    path,
  }
}
