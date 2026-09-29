import type { Checkpoint } from './lookahead.ts'

// "Posso gastar?": quanto sobra para o dia a dia depois das contas e da meta de guardar,
// dividido pelos dias que faltam, comparado com o ritmo atual de gastos.
// No mês atual só conta dinheiro que já está na conta: receita a receber não entra no limite até cair.

export type Verdict = 'green' | 'yellow' | 'red' | 'broke' | 'no-balance' | 'no-income'

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
  available: number | null // saldo em conta agora, se o usuário informou
  reserved?: number // receita do mês seguinte que já caiu (ex.: salário do dia 1º pago no dia 30): fica para o mês dela
}

export interface Allowance {
  verdict: Verdict
  cash: number // dinheiro disponível agora (saldo informado ou entrou - saiu no mês)
  free: number // livre para o dia a dia no resto do mês (a partir do início de hoje)
  daysLeft: number // contando hoje
  perDay: number // quanto pode gastar por dia
  leftToday: number // quanto ainda pode gastar hoje
  pace: number // média de gastos do dia a dia por dia até agora
  endBalance: number // no fim do mês, mantendo o ritmo e contando o que ainda vai entrar
  cutPerDay: number // quanto reduzir por dia para caber (quando vermelho)
  incoming: number // a receber ainda neste mês (fora do limite)
  reserved: number
  // Só no mês atual, com a visão dos próximos meses
  binding?: Checkpoint // data que limita o gasto diário
  firstNegative?: { date: Date; balance: number } | null // mantendo a média diária
  horizonEnd?: Date
  path?: Array<{ date: Date; balance: number }>
}

export function computeAllowance(i: AllowanceInput): Allowance {
  const current = i.phase === 'current'
  const daysLeft = current ? i.days - i.day + 1 : i.phase === 'future' ? i.days : 0
  const reserved = current ? (i.reserved ?? 0) : 0
  const cash = current ? (i.available ?? i.received - i.spent) : i.received - i.spent
  const elapsed = current ? i.day : i.days
  const pace = i.phase === 'future' ? 0 : i.spentVariable / Math.max(1, elapsed)
  const ahead = current ? pace * (i.days - i.day) : 0

  // Gasto do dia a dia de hoje volta para o "livre", para o limite de hoje não encolher a cada compra
  const free = current
    ? cash - reserved - i.billsOpen - i.goal + i.spentVariableToday
    : i.received + i.incomeOpen - i.spent - i.billsOpen - i.goal
  const perDay = daysLeft > 0 ? free / daysLeft : 0
  const endBalance = cash - reserved + (current ? i.incomeOpen : 0) - (current ? i.billsOpen + ahead : 0)

  let verdict: Verdict
  if (current && i.available == null && i.received <= 0) verdict = 'no-balance'
  else if (i.phase === 'future' && i.received + i.incomeOpen <= 0) verdict = 'no-income'
  else if (free <= 0) verdict = 'broke'
  else if (i.phase === 'future') verdict = 'green'
  else if (pace > perDay) verdict = 'red'
  else if (pace > perDay * 0.8) verdict = 'yellow'
  else verdict = 'green'

  return {
    verdict,
    cash,
    free,
    daysLeft,
    perDay,
    leftToday: Math.max(0, perDay - (current ? i.spentVariableToday : 0)),
    pace,
    endBalance,
    cutPerDay: Math.max(0, pace - perDay),
    incoming: current ? i.incomeOpen : 0,
    reserved,
  }
}
