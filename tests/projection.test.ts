import { test } from 'node:test'
import assert from 'node:assert/strict'
import { projectMonths, estimateVariablePerMonth } from '../src/lib/projection.ts'
import type { Planned } from '../src/lib/planned.ts'

const p = (o: Partial<Planned>): Planned => ({
  id: Math.random().toString(36), kind: 'expense', amount: 0, description: 'x', category_id: null, method: null,
  type: 'monthly', day: 5, start_month: '2026-09-01', installments: null, end_month: null, skipped_months: [], ...o,
})

const planned = [
  p({ kind: 'income', amount: 10000, description: 'Salário', day: 31 }),
  p({ amount: 3000, description: 'Aluguel' }),
  p({ amount: 500, description: 'Notebook', type: 'installments', installments: 3, start_month: '2026-09-01' }), // set, out, nov
  p({ amount: 1000, description: 'IPVA', type: 'once', start_month: '2027-01-01' }),
  p({ amount: 200, description: 'Academia', skipped_months: ['2026-12-01'] }),
]

test('acumula mês a mês; parcelas acabam; avulsa só no mês; pulado não conta', () => {
  const rows = projectMonths({
    planned, paid: new Map(),
    current: { month: '2026-09', willReceive: 10000, bills: 4000, variable: 1500 },
    variablePerMonth: 2000, horizon: 5, includeVariable: true,
  })
  assert.deepEqual(rows.map((r) => r.month), ['2026-09', '2026-10', '2026-11', '2026-12', '2027-01'])
  assert.equal(rows[0].balance, 4500) // 10000 - 4000 - 1500
  assert.equal(rows[1].bills, 3700) // aluguel + notebook + academia
  assert.equal(rows[1].balance, 4300)
  assert.equal(rows[3].bills, 3000) // notebook acabou, academia pulada
  assert.equal(rows[4].bills, 4200) // + IPVA
  assert.equal(rows[4].cumulative, 4500 + 4300 + 4300 + 5000 + 3800)
})

test('com saldo inicial o acumulado parte dele', () => {
  const rows = projectMonths({
    planned, paid: new Map(),
    current: { month: '2026-09', willReceive: 10000, bills: 4000, variable: 1500 },
    variablePerMonth: 2000, horizon: 2, includeVariable: true, start: 1000,
  })
  assert.equal(rows[0].cumulative, 5500)
  assert.equal(rows[1].cumulative, 9800)
})

test('sem dia a dia estimado', () => {
  const rows = projectMonths({
    planned, paid: new Map(),
    current: { month: '2026-09', willReceive: 10000, bills: 4000, variable: 1500 },
    variablePerMonth: 2000, horizon: 2, includeVariable: false,
  })
  assert.equal(rows[0].balance, 6000)
  assert.equal(rows[1].balance, 6300)
})

test('média do dia a dia usa meses completos anteriores e ignora contas previstas', () => {
  const txs = [
    { kind: 'expense', amount: 1000, occurred_at: '2026-08-10T12:00:00', planned_id: null },
    { kind: 'expense', amount: 3000, occurred_at: '2026-08-11T12:00:00', planned_id: 'aluguel' },
    { kind: 'expense', amount: 2000, occurred_at: '2026-07-10T12:00:00' },
    { kind: 'expense', amount: 999, occurred_at: '2026-09-10T12:00:00' }, // mês atual não entra
  ]
  assert.equal(estimateVariablePerMonth(txs, '2026-09', 50), 1500)
  assert.equal(estimateVariablePerMonth([], '2026-09', 50), 1500) // sem histórico: 50/dia × 30
})
