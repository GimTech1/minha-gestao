import { test } from 'node:test'
import assert from 'node:assert/strict'
import { occurrenceFor, occurrencesInMonth, occStatus, paidIndex, findMatch, dueDate, type Planned } from '../src/lib/planned.ts'

const base: Planned = {
  id: 'p1', kind: 'expense', amount: 1800, description: 'Aluguel', category_id: null, method: 'pix',
  type: 'monthly', day: 5, start_month: '2026-09-01', installments: null, end_month: null, skipped_months: [],
}

test('monthly: aparece a partir do início, respeita fim e pulos', () => {
  assert.equal(occurrenceFor(base, '2026-08'), null)
  assert.equal(occurrenceFor(base, '2026-09')?.dueKey, '2026-09-05')
  assert.ok(occurrenceFor(base, '2027-03'))
  assert.equal(occurrenceFor({ ...base, end_month: '2026-11-01' }, '2026-12'), null)
  assert.equal(occurrenceFor({ ...base, skipped_months: ['2026-10-01'] }, '2026-10')?.skipped, true)
})

test('installments: numera e termina na última parcela', () => {
  const p: Planned = { ...base, id: 'p2', type: 'installments', installments: 3, description: 'Celular', amount: 300 }
  assert.equal(occurrenceFor(p, '2026-09')?.label, 'Celular (1/3)')
  assert.equal(occurrenceFor(p, '2026-11')?.label, 'Celular (3/3)')
  assert.equal(occurrenceFor(p, '2026-12'), null)
})

test('once: só no mês de início', () => {
  const p: Planned = { ...base, id: 'p3', type: 'once' }
  assert.ok(occurrenceFor(p, '2026-09'))
  assert.equal(occurrenceFor(p, '2026-10'), null)
})

test('dia 31 em fevereiro vira o último dia', () => {
  assert.equal(dueDate('2027-02', 31).getDate(), 28)
})

test('status e pagamento', () => {
  const today = new Date(2026, 8, 10)
  const paid = paidIndex([{ id: 't1', planned_id: 'p1', planned_month: '2026-09-01', amount: 1800 }])
  const [o] = occurrencesInMonth([base], '2026-09', paid)
  assert.equal(occStatus(o, today), 'paid')
  const [open] = occurrencesInMonth([base], '2026-09')
  assert.equal(occStatus(open, today), 'overdue')
  assert.equal(occStatus(open, new Date(2026, 8, 5)), 'today')
  assert.equal(occStatus(open, new Date(2026, 8, 1)), 'upcoming')
})

test('salário do dia 1º que cai no dia 30 casa com o mês seguinte', () => {
  const salary: Planned = { ...base, id: 's', kind: 'income', amount: 11250, description: 'Salário', day: 1 }
  const paid = paidIndex([{ id: 't', planned_id: 's', planned_month: '2026-09-01', amount: 11250 }])
  const m = findMatch([salary], paid, 'income', 11250, 'Transferência recebida de EMPRESA', new Date(2026, 8, 30))
  assert.equal(m?.month, '2026-10')
  // muito antes (dia 20) não casa com outubro
  assert.equal(findMatch([salary], paid, 'income', 11250, 'EMPRESA', new Date(2026, 8, 20)), null)
})

test('findMatch: valor + nome ou vencimento próximo', () => {
  const netflix: Planned = { ...base, id: 'n', description: 'Netflix', amount: 55.9, day: 20 }
  const plans = [base, netflix]
  const today = new Date(2026, 8, 6)
  const none = new Map()
  // Aluguel vence dia 5 (1 dia) e o valor bate
  assert.equal(findMatch(plans, none, 'expense', 1800, 'Pix enviado para JOAO', today)?.planned.id, 'p1')
  // Netflix vence dia 20 (longe), mas o nome bate
  assert.equal(findMatch(plans, none, 'expense', 55.9, 'NETFLIX.COM', today)?.planned.id, 'n')
  // Mesmo valor, nome diferente e vencimento longe (ainda não venceu): não casa
  assert.equal(findMatch(plans, none, 'expense', 55.9, 'Padaria', today), null)
  // Atrasada há 3 semanas, nome diferente, mas valor exato: casa
  assert.equal(findMatch(plans, none, 'expense', 1800, 'Pix para JOAO PROPRIETARIO', new Date(2026, 8, 28))?.planned.id, 'p1')
  // Valor diferente: não casa
  assert.equal(findMatch(plans, none, 'expense', 1500, 'Aluguel', today), null)
  // Já pago: não casa de novo
  const paid = paidIndex([{ id: 't', planned_id: 'p1', planned_month: '2026-09-01', amount: 1800 }])
  assert.equal(findMatch(plans, paid, 'expense', 1800, 'Aluguel', today), null)
  // Atrasada do mês anterior ainda casa
  assert.equal(findMatch([{ ...base, start_month: '2026-08-01', day: 28 }], paid, 'expense', 1800, 'aluguel', new Date(2026, 8, 2))?.month, '2026-08')
})
