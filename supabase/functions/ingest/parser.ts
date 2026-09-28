// Parser de textos de banco (SMS, notificação, e-mail, Wallet) e texto livre ("35 almoço").
// Sem dependências: o mesmo arquivo roda no app (Vite) e na Edge Function (Deno).

export type Kind = 'expense' | 'income'
export type Method = 'pix' | 'credito' | 'debito' | 'dinheiro' | 'boleto' | 'transferencia' | 'outro'

export interface Parsed {
  amount: number | null
  kind: Kind
  method: Method | null
  description: string | null
  date: Date | null
}

const norm = (s: string) =>
  s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

// "1.234,56" | "1234,56" | "45.90" | "45" -> number
export function parseMoney(raw: string): number | null {
  let s = raw.trim().replace(/[^\d.,]/g, '')
  if (!s) return null
  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')
  if (lastComma > lastDot) {
    s = s.replace(/\./g, '').replace(',', '.')
  } else if (lastDot > lastComma) {
    // "1.234" (milhar) vs "45.90" (decimal com ponto)
    const decimals = s.length - lastDot - 1
    s = decimals === 3 && lastComma === -1 ? s.replace(/\./g, '') : s.replace(/,/g, '')
  }
  const n = Number(s)
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null
}

const MONEY_RE = /(?:R\$|BRL|RS)\s*-?\s*(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)/i

const INCOME_RE =
  /\b(recebeu|recebid[oa]|recebimento|voce recebeu|entrada|deposito|credito em conta|creditad[oa]|estorno|reembolso|cashback|caiu)\b/
const EXPENSE_HINT_RE =
  /\b(enviad[oa]|enviou|compra|pagamento|pago|paga|debitad[oa]|debito|saque|transferiu|aprovad[oa])\b/

function detectMethod(t: string): Method | null {
  if (/\bpix\b/.test(t)) return 'pix'
  if (/\bboleto\b|pagamento de conta/.test(t)) return 'boleto'
  if (/\bdebito\b/.test(t) && !/\bcredito\b/.test(t)) return 'debito'
  if (/\bcredito\b|\bcartao\b|compra aprovada|compra de/.test(t)) return 'credito'
  if (/\bted\b|\bdoc\b|transferencia/.test(t)) return 'transferencia'
  if (/\bdinheiro\b|\bespecie\b/.test(t)) return 'dinheiro'
  return null
}

export function cleanMerchant(s: string): string | null {
  let m = s
    .replace(/\s+/g, ' ')
    .replace(/\b(com sucesso|foi aprovad[oa]|aprovad[oa]|realizad[oa])\b.*$/i, '')
    .replace(/\s*(?:para o |no )?cart[aã]o.*$/i, '')
    .replace(/\s+(?:pelo|via|por)\s+pix.*$/i, '')
    .replace(/\s*(?:em|dia)\s+\d{1,2}\/\d{1,2}.*$/i, '')
    .replace(/[.,;:!\-–]+$/g, '')
    .trim()
  // tira CPF/CNPJ mascarado, códigos e sobras comuns
  m = m.replace(/\*{2,}[\d.*-]*\**/g, '').replace(/\s{2,}/g, ' ').trim()
  if (m.length < 2 || /^\d+([.,]\d+)?$/.test(m)) return null
  if (m.length > 60) m = m.slice(0, 60).trim()
  // Title Case suave para textos TODO EM MAIÚSCULAS
  if (m === m.toUpperCase()) {
    m = m.toLowerCase().replace(/(^|[^\p{L}'])(\p{L})/gu, (_, sp, c) => sp + c.toUpperCase())
  }
  return m
}

// Padrões de onde/para quem. Ordem importa: mais específico primeiro.
const MERCHANT_PATTERNS: RegExp[] = [
  /(?:estabelecimento|loja|local)[:\s]+(.+?)(?:\.|,|\bno valor\b|\bvalor\b|$)/i,
  /\bpara\s+(?!o cart|seu cart|a conta)(.+?)(?:\.|,|\bfoi\b|\bno valor\b|\bvalor\b|\bem \d|\bcom\b|$)/i,
  /\b(?:de|do|da)\s+(?!R\$|\d)(.+?)(?:\.|,|\bfoi\b|\bno valor\b|\bem \d|$)/i,
  /\bem\s+(?!\d{1,2}\/)(?!R\$)(.+?)(?:\.|,|\bpara\b|\bno valor\b|\bvalor\b|$)/i,
  /R\$\s*\d[\d.]*(?:,\d{1,2})?\s*[-–]\s*(.+?)(?:\.|$)/i,
  // Itaú/Bradesco: "... às 13:20, PADARIA X."  /  "VALOR DE R$ 45,90, PADARIA X."
  /(?:\d{2}:\d{2}|R\$\s*\d[\d.]*(?:,\d{1,2})?|R\$VAL)\s*,\s*([^,.]+?)\.?\s*$/i,
]

function extractMerchant(text: string, kind: Kind): string | null {
  // Remove o trecho do valor para não confundir "de R$ 45" com "de FULANO"
  const t = text.replace(/\b(?:no valor de|valor de|de)\s+R\$\s*\d[\d.]*(?:,\d{1,2})?/gi, ' R$VAL ')
  const order = kind === 'income' ? [2, 1, 0, 3, 4, 5] : [0, 1, 3, 4, 5, 2]
  for (const i of order) {
    const m = t.match(MERCHANT_PATTERNS[i])
    if (m?.[1]) {
      const cleaned = cleanMerchant(m[1].replace(/R\$VAL/g, ''))
      if (cleaned && !/^(r\$|voce|sua|seu|conta|uma transferencia)/i.test(cleaned)) return cleaned
    }
  }
  return null
}

function extractDate(text: string, now = new Date()): Date | null {
  const m = text.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?:[^\d]{1,6}(\d{1,2})[:h](\d{2}))?/)
  if (!m) return null
  const day = +m[1], month = +m[2] - 1
  let year = m[3] ? +m[3] : now.getFullYear()
  if (year < 100) year += 2000
  if (month < 0 || month > 11 || day < 1 || day > 31) return null
  const d = new Date(year, month, day, m[4] ? +m[4] : now.getHours(), m[5] ? +m[5] : now.getMinutes())
  // "28/12" lido em janeiro é do ano passado
  if (!m[3] && d.getTime() - now.getTime() > 2 * 86400000) d.setFullYear(year - 1)
  return d
}

export function parseBankText(input: string, now = new Date()): Parsed {
  const text = input.replace(/\s+/g, ' ').trim()
  const t = norm(text)

  const moneyMatch = text.match(MONEY_RE)
  let amount = moneyMatch ? parseMoney(moneyMatch[1]) : null

  const isBankish = !!moneyMatch || EXPENSE_HINT_RE.test(t) || INCOME_RE.test(t)

  // Texto livre: "35 almoço", "almoço 35,90", "uber 22.5"
  if (!moneyMatch) {
    const free = text.match(/(?:^|\s)(\d+(?:[.,]\d{1,2})?)(?=\s|$)/)
    if (free) {
      amount = parseMoney(free[1])
      if (!EXPENSE_HINT_RE.test(t) && !INCOME_RE.test(t)) {
        const rest = (text.slice(0, free.index) + ' ' + text.slice((free.index ?? 0) + free[0].length))
          .replace(/\b(reais|real|conto|contos|pila)\b/gi, '')
          .replace(/\s+/g, ' ')
          .trim()
        const income = /^\+|\b(recebi|ganhei|entrou)\b/i.test(text)
        return {
          amount,
          kind: income ? 'income' : 'expense',
          method: detectMethod(t),
          description: rest ? rest.charAt(0).toUpperCase() + rest.slice(1) : null,
          date: null,
        }
      }
    }
  }

  const income = INCOME_RE.test(t) && !/\b(enviad[oa]|enviou|voce pagou|compra)\b/.test(t)
  const kind: Kind = income ? 'income' : 'expense'

  return {
    amount,
    kind,
    method: detectMethod(t),
    description: isBankish ? extractMerchant(text, kind) : null,
    date: extractDate(text, now),
  }
}

// Escolhe a categoria cuja palavra-chave aparece no texto (maior palavra vence).
export function guessCategory<C extends { id: string; kind: string; keywords: string[] }>(
  text: string,
  kind: Kind,
  categories: C[],
): C | null {
  const t = ' ' + norm(text) + ' '
  let best: C | null = null
  let bestLen = 0
  for (const c of categories) {
    if (c.kind !== kind) continue
    for (const kw of c.keywords) {
      const k = norm(kw).trim()
      if (!k) continue
      const re = new RegExp(`(^|[^a-z0-9])${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`)
      if (re.test(t) && k.length > bestLen) {
        best = c
        bestLen = k.length
      }
    }
  }
  return best
}
