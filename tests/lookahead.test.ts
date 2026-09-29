import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeLookahead } from '../src/lib/lookahead.ts'

const d = (m: number, day: number) => new Date(2026, m - 1, day)

// Cenário do Bruno em 28/09: R$ 1.592 na conta, salário e contas no dia 1º, sinal do carro em 31/10
const events = [
  { date: d(10, 1), amount: 11250, label: 'Salário' },
  { date: d(10, 1), amount: -4476, label: 'Contas do dia 1º' },
  { date: d(10, 31), amount: -5150, label: 'Sinal carro' },
  { date: d(11, 1), amount: 11250, label: 'Salário' },
  { date: d(11, 1), amount: -4476, label: 'Contas' },
]
const monthEnds = [d(9, 30), d(10, 31), d(11, 30)]

test('outubro limita o gasto diário, não o fim de setembro', () => {
  const r = computeLookahead({ today: d(9, 28), cash: 1592, spentToday: 0, pace: 0, events, monthEnds })
  // até 30/09: 1592/3 = 530; até 31/10: (1592 + 11250 - 4476 - 5150)/34 = 94,6
  assert.equal(r.binding.date.getTime(), d(10, 31).getTime())
  assert.equal(r.binding.days, 34)
  assert.equal(Math.round(r.perDay * 10) / 10, 94.6)
})

test('no ritmo atual acusa a primeira data negativa', () => {
  const r = computeLookahead({ today: d(9, 28), cash: 1592, spentToday: 0, pace: 150, events, monthEnds })
  // 31/10: 3216 - 150×34 = -1884
  assert.equal(r.firstNegative?.date.getTime(), d(10, 31).getTime())
  assert.equal(Math.round(r.firstNegative!.balance), -1884)
  const ok = computeLookahead({ today: d(9, 28), cash: 1592, spentToday: 0, pace: 50, events, monthEnds })
  assert.equal(ok.firstNegative, null)
})

test('conta atrasada conta como hoje; gasto de hoje volta para o limite do dia', () => {
  const r = computeLookahead({
    today: d(9, 28), cash: 900, spentToday: 100, pace: 0,
    events: [{ date: d(9, 20), amount: -400, label: 'Atrasada' }], monthEnds: [d(9, 30)],
  })
  // (900 + 100 - 400) / 3
  assert.equal(r.perDay, 200)
})

test('não deixa gastar hoje o salário que só cai amanhã', () => {
  const r = computeLookahead({
    today: d(9, 28), cash: 100, spentToday: 0, pace: 0,
    events: [{ date: d(9, 29), amount: 10000, label: 'Salário' }], monthEnds: [d(9, 30)],
  })
  assert.equal(r.perDay, 100)
})

test('sem contas futuras vale o fim do mês', () => {
  const r = computeLookahead({ today: d(9, 28), cash: 300, spentToday: 0, pace: 0, events: [], monthEnds: [d(9, 30)] })
  assert.equal(r.perDay, 100)
})
