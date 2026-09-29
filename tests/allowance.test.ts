import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeAllowance, type AllowanceInput } from '../src/lib/allowance.ts'

// Dia 20 de um mês de 30 dias: salário de 10.000 já caiu, 4.000 de contas pagas, 2.000 de dia a dia
const base: AllowanceInput = {
  phase: 'current', days: 30, day: 20, spent: 6000, spentVariable: 2000, spentVariableToday: 0,
  received: 10000, billsOpen: 500, incomeOpen: 0, goal: 1000, available: null,
}

test('livre = entra - gasto - contas - meta; por dia divide pelos dias que faltam (com hoje)', () => {
  const a = computeAllowance(base)
  assert.equal(a.free, 2500)
  assert.equal(a.daysLeft, 11)
  assert.equal(Math.round(a.perDay), 227)
  assert.equal(a.pace, 100)
  assert.equal(a.verdict, 'green')
})

test('ritmo perto do limite fica amarelo, acima fica vermelho', () => {
  assert.equal(computeAllowance({ ...base, goal: 2200 }).verdict, 'yellow') // livre 1300 -> ~118/dia, ritmo 100
  const red = computeAllowance({ ...base, goal: 2500 }) // livre 1000 -> ~91/dia
  assert.equal(red.verdict, 'red')
  assert.equal(Math.round(red.cutPerDay), 9)
})

test('sem folga quando contas + meta passam do que entra', () => {
  assert.equal(computeAllowance({ ...base, goal: 4000 }).verdict, 'broke')
})

test('sem saldo informado e nada recebido no mês: pede o saldo', () => {
  assert.equal(computeAllowance({ ...base, received: 0 }).verdict, 'no-balance')
})

test('gasto de hoje não encolhe o limite do dia, só o que resta hoje', () => {
  const a = computeAllowance({ ...base, spent: 6100, spentVariable: 2100, spentVariableToday: 100 })
  assert.equal(a.free, 2500)
  assert.equal(Math.round(a.leftToday), 127)
})

test('salário a receber NÃO entra no limite; só no saldo do fim do mês', () => {
  const pend = { ...base, received: 0, spent: 3000, spentVariable: 2000, incomeOpen: 10000 }
  assert.equal(computeAllowance(pend).verdict, 'no-balance')
  const a = computeAllowance({ ...pend, available: 3000 })
  assert.equal(a.free, 1500) // 3000 na conta - 500 contas - 1000 meta
  assert.equal(a.incoming, 10000)
  assert.equal(Math.round(a.endBalance), 3000 + 10000 - 500 - 1000) // ritmo 100/dia × 10 dias
})

test('saldo informado vence o "entrou - saiu" do mês', () => {
  const a = computeAllowance({ ...base, available: 800 })
  assert.equal(a.cash, 800)
  assert.equal(a.verdict, 'broke') // 800 - 500 - 1000 < 0
})

test('mês futuro sem receita', () => {
  assert.equal(computeAllowance({ ...base, phase: 'future', received: 0, incomeOpen: 0 }).verdict, 'no-income')
})

test('mês futuro: só previstos, divide pelo mês inteiro', () => {
  const a = computeAllowance({ ...base, phase: 'future', spent: 0, spentVariable: 0, received: 0, incomeOpen: 10000, billsOpen: 4000 })
  assert.equal(a.free, 5000)
  assert.equal(Math.round(a.perDay), 167)
  assert.equal(a.verdict, 'green')
})
