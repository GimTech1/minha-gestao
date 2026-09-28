// "Posso gastar?": quanto sobra para o dia a dia depois das contas e da meta de guardar,
// dividido pelos dias que faltam, comparado com o ritmo atual de gastos.

export type Verdict = 'green' | 'yellow' | 'red' | 'broke' | 'no-income'

export interface AllowanceInput {
  phase: 'past' | 'current' | 'future'
  days: number // dias no mês
  day: number // dia de hoje (só no mês atual)
  spent: number // tudo que já saiu no mês
  spentVariable: number // gastos do dia a dia (sem contas previstas)
  spentVariableToday: number
  received: number
  billsOpen: number
  incomeOpen: number
  goal: number // quanto quer guardar no mês
}

export interface Allowance {
  verdict: Verdict
  free: number // livre para o dia a dia no resto do mês (a partir do início de hoje)
  daysLeft: number // contando hoje
  perDay: number // quanto pode gastar por dia
  leftToday: number // quanto ainda pode gastar hoje
  pace: number // média de gastos do dia a dia por dia até agora
  endBalance: number // saldo no fim do mês mantendo o ritmo
  cutPerDay: number // quanto reduzir por dia para caber (quando vermelho)
}

export function computeAllowance(i: AllowanceInput): Allowance {
  const willReceive = i.received + i.incomeOpen
  const daysLeft = i.phase === 'current' ? i.days - i.day + 1 : i.phase === 'future' ? i.days : 0
  // Gasto do dia a dia de hoje volta para o "livre", para o limite de hoje não encolher a cada compra
  const free = willReceive - i.spent - i.billsOpen - i.goal + (i.phase === 'current' ? i.spentVariableToday : 0)
  const perDay = daysLeft > 0 ? free / daysLeft : 0
  const elapsed = i.phase === 'current' ? i.day : i.days
  const pace = i.phase === 'future' ? 0 : i.spentVariable / Math.max(1, elapsed)
  const ahead = i.phase === 'current' ? pace * (i.days - i.day) : 0
  const endBalance = willReceive - i.spent - i.billsOpen - ahead

  let verdict: Verdict
  if (willReceive <= 0) verdict = 'no-income'
  else if (free <= 0) verdict = 'broke'
  else if (i.phase === 'future') verdict = 'green'
  else if (pace > perDay) verdict = 'red'
  else if (pace > perDay * 0.8) verdict = 'yellow'
  else verdict = 'green'

  return {
    verdict,
    free,
    daysLeft,
    perDay,
    leftToday: Math.max(0, perDay - (i.phase === 'current' ? i.spentVariableToday : 0)),
    pace,
    endBalance,
    cutPerDay: Math.max(0, pace - perDay),
  }
}
