import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseBankText, parseMoney, guessCategory } from '../src/lib/parser.ts'

const now = new Date(2026, 8, 28, 14, 0)

const cases: Array<[string, { amount: number; kind: string; method?: string | null; description?: string | null }]> = [
  ['Compra de R$ 45,90 APROVADA em PADARIA BELA VISTA para o cartão com final 1234.',
    { amount: 45.9, kind: 'expense', method: 'credito', description: 'Padaria Bela Vista' }],
  ['Itaú: compra aprovada no cartão final 1234 de R$ 1.234,56 em 28/09 às 13:20, MERCADO LIVRE.',
    { amount: 1234.56, kind: 'expense', method: 'credito', description: 'Mercado Livre' }],
  ['Transferência enviada: Você enviou R$ 50,00 para João da Silva pelo Pix.',
    { amount: 50, kind: 'expense', method: 'pix', description: 'João da Silva' }],
  ['Pix enviado! Você enviou R$ 120,00 para MARIA SOUZA.',
    { amount: 120, kind: 'expense', method: 'pix', description: 'Maria Souza' }],
  ['Transferência recebida: Você recebeu uma transferência de R$ 300,00 de Carlos Pereira.',
    { amount: 300, kind: 'income', description: 'Carlos Pereira' }],
  ['Pix recebido de R$ 80,00 de ANA LIMA',
    { amount: 80, kind: 'income', method: 'pix', description: 'Ana Lima' }],
  ['BRADESCO CARTOES: COMPRA APROVADA NO CARTAO FINAL 1234 EM 28/09/2026 13:20. VALOR DE R$ 45,90, POSTO SHELL.',
    { amount: 45.9, kind: 'expense', method: 'credito', description: 'Posto Shell' }],
  ['Compra no débito aprovada: R$ 23,50 em UBER *TRIP',
    { amount: 23.5, kind: 'expense', method: 'debito' }],
  ['35 almoço', { amount: 35, kind: 'expense', description: 'Almoço' }],
  ['uber 22,50', { amount: 22.5, kind: 'expense', description: 'Uber' }],
  ['recebi 1500 freela', { amount: 1500, kind: 'income' }],
  ['R$ 9,90', { amount: 9.9, kind: 'expense' }],
]

for (const [text, exp] of cases) {
  test(text, () => {
    const p = parseBankText(text, now)
    assert.equal(p.amount, exp.amount)
    assert.equal(p.kind, exp.kind)
    if ('method' in exp) assert.equal(p.method, exp.method)
    if ('description' in exp) assert.equal(p.description, exp.description)
  })
}

test('parseMoney', () => {
  assert.equal(parseMoney('1.234,56'), 1234.56)
  assert.equal(parseMoney('45.90'), 45.9)
  assert.equal(parseMoney('1.234'), 1234)
  assert.equal(parseMoney('0'), null)
})

test('date extraction', () => {
  const p = parseBankText('Itaú: compra aprovada de R$ 10,00 em 27/09 às 08:15, LOJA X.', now)
  assert.equal(p.date?.getDate(), 27)
  assert.equal(p.date?.getHours(), 8)
})

test('guessCategory', () => {
  const cats = [
    { id: 'a', kind: 'expense', keywords: ['uber', '99'] },
    { id: 'b', kind: 'expense', keywords: ['mercado', 'mercado livre'] },
  ]
  assert.equal(guessCategory('UBER *TRIP', 'expense', cats)?.id, 'a')
  assert.equal(guessCategory('Mercado Livre', 'expense', cats)?.id, 'b')
  assert.equal(guessCategory('R$ 199,00 loja', 'expense', cats), null)
})
