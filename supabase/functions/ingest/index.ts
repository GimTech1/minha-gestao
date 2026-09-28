// Recebe lançamentos dos Atalhos do iOS (Wallet, SMS, e-mail, Siri) e grava no banco.
// Autenticação pelo token pessoal do perfil (profiles.ingest_token), não por JWT.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { parseBankText, parseMoney, guessCategory, cleanMerchant } from './parser.ts'
import { findMatch, paidIndex, monthOf, monthStart, addMonths, type Planned } from './planned.ts'

// A função roda em UTC; datas "de parede" do Brasil (sem horário de verão desde 2019) ficam 3h deslocadas
const BRT_OFFSET = 3 * 3600000
const brtNow = () => new Date(Date.now() - BRT_OFFSET)

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-token, authorization, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

async function sha256(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ ok: false, message: 'Use POST' }, 405)

  let body: Record<string, unknown> = {}
  const ct = req.headers.get('content-type') ?? ''
  try {
    if (ct.includes('multipart')) body = Object.fromEntries((await req.formData()).entries())
    else {
      const raw = await req.text()
      if (ct.includes('json') || raw.trim().startsWith('{')) body = JSON.parse(raw)
      else {
        // Formulário de verdade tem campos conhecidos; senão é texto puro enviado sem content-type
        const form = new URLSearchParams(raw)
        body = ['text', 'amount', 'merchant'].some((k) => form.has(k)) ? Object.fromEntries(form) : { text: raw }
      }
    }
  } catch {
    return json({ ok: false, message: 'Corpo inválido' }, 400)
  }

  const url = new URL(req.url)
  const token = String(req.headers.get('x-token') ?? body.token ?? url.searchParams.get('t') ?? '').trim()
  if (!/^[0-9a-f-]{36}$/i.test(token)) return json({ ok: false, message: 'Token ausente ou inválido' }, 401)

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  })

  const { data: profile } = await db.from('profiles').select('id').eq('ingest_token', token).maybeSingle()
  if (!profile) return json({ ok: false, message: 'Token não reconhecido' }, 401)
  const userId = profile.id as string

  // Campos estruturados (automação da Wallet) têm prioridade sobre o texto.
  const text = String(body.text ?? '').trim()
  const merchant = cleanMerchant(String(body.merchant ?? '')) ?? ''
  const card = String(body.card ?? '').trim()
  const parsed = parseBankText(text || `${body.amount ?? ''} ${merchant}`)

  const amount = body.amount != null && String(body.amount).trim() !== '' ? parseMoney(String(body.amount)) : parsed.amount
  if (!amount) return json({ ok: false, message: 'Não encontrei o valor no texto', text }, 422)

  const kind = (body.kind === 'income' || body.kind === 'expense' ? body.kind : parsed.kind) as 'expense' | 'income'
  const description = merchant || parsed.description || null
  let method = parsed.method
  if (merchant && !method) method = /d[eé]bito/i.test(card) ? 'debito' : 'credito'

  const { data: categories } = await db
    .from('categories')
    .select('id, name, emoji, kind, keywords')
    .eq('user_id', userId)
  const cats = categories ?? []

  let category = guessCategory(`${description ?? ''} ${text}`, kind, cats)
  if (!category && description) {
    // Aprende com o histórico: mesma descrição -> mesma categoria
    const { data: prev } = await db
      .from('transactions')
      .select('category_id')
      .eq('user_id', userId)
      .ilike('description', description)
      .not('category_id', 'is', null)
      .order('occurred_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (prev) category = cats.find((c) => c.id === prev.category_id) ?? null
  }
  if (!category) category = cats.find((c) => c.kind === kind && /outros|entradas/i.test(c.name)) ?? null

  // Dá baixa na conta prevista correspondente (mesmo valor + nome parecido ou vencimento próximo)
  const today = brtNow()
  const [{ data: plans }, { data: paidRows }] = await Promise.all([
    db
      .from('planned')
      .select('id, kind, amount, description, category_id, method, type, day, start_month, installments, end_month, skipped_months')
      .eq('user_id', userId),
    db
      .from('transactions')
      .select('id, planned_id, planned_month, amount')
      .eq('user_id', userId)
      .not('planned_id', 'is', null)
      .gte('planned_month', monthStart(addMonths(monthOf(today), -1))),
  ])
  const match = findMatch(
    (plans ?? []).map((p) => ({ ...p, amount: Number(p.amount) }) as Planned),
    paidIndex((paidRows ?? []).map((r) => ({ ...r, amount: Number(r.amount) }))),
    kind,
    amount,
    `${description ?? ''} ${text}`,
    today,
  )
  if (match?.planned.category_id) category = cats.find((c) => c.id === match.planned.category_id) ?? category

  const parsedDate = parsed.date ? new Date(parsed.date.getTime() + BRT_OFFSET) : null
  const occurredAt = parsedDate && Math.abs(parsedDate.getTime() - Date.now()) < 40 * 86400000 ? parsedDate : new Date()
  const raw = text || `${amount}|${merchant}|${card}`
  const rawHash = await sha256(`${raw}|${new Date().toISOString().slice(0, 16)}`)

  const { data: tx, error } = await db
    .from('transactions')
    .insert({
      user_id: userId,
      kind,
      amount,
      description,
      method,
      category_id: category?.id ?? null,
      occurred_at: occurredAt.toISOString(),
      source: 'auto',
      raw_text: raw.slice(0, 1000),
      raw_hash: rawHash,
      planned_id: match?.planned.id ?? null,
      planned_month: match ? monthStart(match.month) : null,
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') return json({ ok: true, duplicate: true, message: 'Já registrado' })
    return json({ ok: false, message: error.message }, 500)
  }

  const sign = kind === 'income' ? '+' : '−'
  return json({
    ok: true,
    id: tx.id,
    amount,
    kind,
    description,
    category: category?.name ?? null,
    planned: match ? match.label : null,
    message:
      `${category?.emoji ?? '✅'} ${sign}${brl(amount)}${description ? ' · ' + description : ''}${category ? ' (' + category.name + ')' : ''}` +
      (match ? ` · ✓ ${match.label} ${kind === 'income' ? 'recebida' : 'paga'}` : ''),
  })
})
