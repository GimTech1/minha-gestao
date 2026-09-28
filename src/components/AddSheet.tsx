import { useEffect, useMemo, useRef, useState } from 'react'
import { Sheet } from './Sheet'
import { IconClip, IconDel, IconTrash, IconX } from './icons'
import { useStore, type Kind, type Tx } from '../lib/store'
import { parseBankText, guessCategory } from '../lib/parser'
import { METHODS, dayKey, haptic, toDateInput } from '../lib/format'
import { findMatch, monthStart, paidIndex } from '../lib/planned'

const norm = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()

interface Props {
  editing?: Tx | null
  onClose: () => void
  onSaved: (tx: Tx, isNew: boolean) => void
  onDeleted: (tx: Tx) => void
}

export function AddSheet({ editing, onClose, onSaved, onDeleted }: Props) {
  const { categories, txs, planned, saveTx, deleteTx, savePlanned } = useStore()

  const [kind, setKind] = useState<Kind>(editing?.kind ?? 'expense')
  const [cents, setCents] = useState(editing ? Math.round(editing.amount * 100) : 0)
  const [description, setDescription] = useState(editing?.description ?? '')
  const [categoryId, setCategoryId] = useState<string | null>(editing?.category_id ?? null)
  const [catTouched, setCatTouched] = useState(!!editing)
  const [method, setMethod] = useState<string | null>(editing?.method ?? null)
  const [day, setDay] = useState(editing ? dayKey(new Date(editing.occurred_at)) : dayKey(new Date()))
  const [descFocus, setDescFocus] = useState(false)
  const [note, setNote] = useState('')
  const [fixed, setFixed] = useState(false)
  const holdTimer = useRef<number | undefined>(undefined)

  // Categorias mais usadas primeiro (últimos 90 dias)
  const cats = useMemo(() => {
    const since = new Date(Date.now() - 90 * 86400000).toISOString()
    const freq = new Map<string, number>()
    for (const t of txs) if (t.occurred_at >= since && t.category_id) freq.set(t.category_id, (freq.get(t.category_id) ?? 0) + 1)
    return categories
      .filter((c) => c.kind === kind)
      .sort((a, b) => (freq.get(b.id) ?? 0) - (freq.get(a.id) ?? 0) || a.sort - b.sort)
  }, [categories, txs, kind])

  // Histórico de descrições -> última categoria/método usados
  const history = useMemo(() => {
    const map = new Map<string, { label: string; category_id: string | null; method: string | null; kind: Kind; count: number }>()
    for (const t of txs) {
      if (!t.description) continue
      const k = norm(t.description)
      const cur = map.get(k)
      if (cur) cur.count++
      else map.set(k, { label: t.description, category_id: t.category_id, method: t.method, kind: t.kind, count: 1 })
    }
    return [...map.values()]
  }, [txs])

  const suggestions = useMemo(() => {
    const q = norm(description)
    const pool = history.filter((h) => h.kind === kind)
    if (!q) return pool.sort((a, b) => b.count - a.count).slice(0, 8)
    return pool.filter((h) => norm(h.label).includes(q) && norm(h.label) !== q).slice(0, 6)
  }, [history, description, kind])

  // Palpite de categoria enquanto digita (se o usuário não escolheu manualmente)
  useEffect(() => {
    if (catTouched || !description.trim()) return
    const exact = history.find((h) => norm(h.label) === norm(description) && h.kind === kind)
    const guess = exact?.category_id ?? guessCategory(description, kind, categories)?.id ?? null
    if (guess) setCategoryId(guess)
  }, [description, kind, catTouched, history, categories])

  // Categoria inválida ao trocar gasto/receita
  useEffect(() => {
    if (categoryId && !cats.some((c) => c.id === categoryId)) setCategoryId(null)
  }, [cats, categoryId])

  const press = (k: string) => {
    haptic()
    setCents((c) => {
      if (k === 'del') return Math.floor(c / 10)
      const next = Number(String(c) + k)
      return next > 99_999_999_99 ? c : next
    })
  }

  // Teclado físico (desktop)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (descFocus || (e.target as HTMLElement)?.tagName === 'INPUT') return
      if (/^\d$/.test(e.key)) press(e.key)
      else if (e.key === 'Backspace') press('del')
      else if (e.key === 'Enter') submit()
      else if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const pickSuggestion = (h: (typeof history)[number]) => {
    haptic()
    setDescription(h.label)
    if (h.category_id) {
      setCategoryId(h.category_id)
      setCatTouched(true)
    }
    if (h.method && !method) setMethod(h.method)
  }

  const paste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (!text.trim()) return setNote('Área de transferência vazia')
      const p = parseBankText(text)
      if (!p.amount) return setNote('Não achei um valor no texto copiado')
      setCents(Math.round(p.amount * 100))
      setKind(p.kind)
      if (p.description) setDescription(p.description)
      if (p.method) setMethod(p.method)
      if (p.date) setDay(dayKey(p.date))
      const g = guessCategory(`${p.description ?? ''} ${text}`, p.kind, categories)
      if (g) {
        setCategoryId(g.id)
        setCatTouched(true)
      }
      setNote('✨ Preenchido a partir do texto copiado')
      haptic(15)
    } catch {
      setNote('Permita colar para ler o texto copiado')
    }
  }

  const submit = async () => {
    if (!cents) return
    const today = dayKey(new Date())
    let occurred: Date
    if (editing && dayKey(new Date(editing.occurred_at)) === day) occurred = new Date(editing.occurred_at)
    else if (day === today) occurred = new Date()
    else {
      const [y, m, d] = day.split('-').map(Number)
      occurred = new Date(y, m - 1, d, 12, 0)
    }
    const fallback = cats.find((c) => /outros|entradas/i.test(c.name))
    const tx: Tx = {
      id: editing?.id ?? crypto.randomUUID(),
      kind,
      amount: cents / 100,
      category_id: categoryId ?? fallback?.id ?? null,
      description: description.trim() || null,
      method,
      occurred_at: occurred.toISOString(),
      source: editing?.source ?? 'manual',
      created_at: editing?.created_at,
      planned_id: editing?.planned_id ?? null,
      planned_month: editing?.planned_month ?? null,
    }
    const month = dayKey(occurred).slice(0, 7)
    if (!editing && fixed) {
      // Vira conta prevista todo mês, e este lançamento já paga o mês atual
      const planId = crypto.randomUUID()
      try {
        await savePlanned({
          id: planId,
          kind,
          amount: tx.amount,
          description: tx.description ?? cats.find((c) => c.id === tx.category_id)?.name ?? 'Conta fixa',
          category_id: tx.category_id,
          method,
          type: 'monthly',
          day: occurred.getDate(),
          start_month: monthStart(month),
          installments: null,
          end_month: null,
          skipped_months: [],
        })
        tx.planned_id = planId
        tx.planned_month = monthStart(month)
      } catch {
        setNote('Sem conexão para criar a conta fixa; salvei só o lançamento')
      }
    } else if (!editing) {
      // Se bate com uma conta prevista em aberto, já dá baixa nela
      const m = findMatch(planned, paidIndex(txs), kind, tx.amount, tx.description ?? '', occurred)
      if (m) {
        tx.planned_id = m.planned.id
        tx.planned_month = monthStart(m.month)
      }
    }
    haptic(20)
    saveTx(tx)
    onSaved(tx, !editing)
  }

  const remove = () => {
    if (!editing) return
    deleteTx(editing.id)
    onDeleted(editing)
  }

  const reais = Math.floor(cents / 100).toLocaleString('pt-BR')
  const cc = String(cents % 100).padStart(2, '0')
  const today = dayKey(new Date())
  const yesterday = dayKey(new Date(Date.now() - 86400000))
  const customDay = day !== today && day !== yesterday
  const selCat = categories.find((c) => c.id === categoryId)

  return (
    <Sheet onClose={onClose}>
      <div className="sheet-h">
        <button className="icon-btn" onClick={onClose} aria-label="Fechar"><IconX /></button>
        <div className="seg" style={{ width: 190 }}>
          <button className={kind === 'expense' ? 'on exp' : ''} onClick={() => setKind('expense')}>Gasto</button>
          <button className={kind === 'income' ? 'on inc' : ''} onClick={() => setKind('income')}>Receita</button>
        </div>
        <button className="icon-btn" onClick={paste} aria-label="Colar notificação do banco"><IconClip /></button>
      </div>

      <div className="amount">
        <div className={`v${cents ? '' : ' zero'}`}>
          <small>R$</small>{reais},{cc}
        </div>
      </div>
      <div className="paste-note">{note || (selCat ? `${selCat.emoji} ${selCat.name}` : '')}</div>

      <input
        className="desc-input"
        placeholder={kind === 'expense' ? 'Com o quê? (opcional)' : 'De onde? (opcional)'}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        onFocus={() => setDescFocus(true)}
        onBlur={() => setTimeout(() => setDescFocus(false), 150)}
        enterKeyHint="done"
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        autoCapitalize="sentences"
      />
      {suggestions.length > 0 && (
        <div className="suggest">
          {suggestions.map((h) => (
            <button key={h.label} onMouseDown={(e) => e.preventDefault()} onClick={() => pickSuggestion(h)}>
              {categories.find((c) => c.id === h.category_id)?.emoji} {h.label}
            </button>
          ))}
        </div>
      )}

      <div className="cat-grid">
        {cats.map((c) => (
          <button
            key={c.id}
            className={`cat-chip${c.id === categoryId ? ' on' : ''}`}
            style={{ '--c': c.color } as React.CSSProperties}
            onClick={() => {
              haptic()
              setCategoryId(c.id === categoryId ? null : c.id)
              setCatTouched(true)
            }}
          >
            <span className="e">{c.emoji}</span>
            <span className="n">{c.name}</span>
          </button>
        ))}
      </div>

      <div className="chips">
        <button className={`chip${day === today ? ' on' : ''}`} onClick={() => setDay(today)}>Hoje</button>
        <button className={`chip${day === yesterday ? ' on' : ''}`} onClick={() => setDay(yesterday)}>Ontem</button>
        <label className={`chip${customDay ? ' on' : ''}`}>
          📅 {customDay ? day.split('-').reverse().slice(0, 2).join('/') : 'Data'}
          <input type="date" value={day} max={toDateInput(new Date())} onChange={(e) => e.target.value && setDay(e.target.value)} />
        </label>
        {!editing && (
          <button className={`chip${fixed ? ' on' : ''}`} onClick={() => setFixed(!fixed)}>🔁 Todo mês</button>
        )}
        <span style={{ width: 1, background: 'var(--line)', flex: 'none' }} />
        {METHODS.map((m) => (
          <button key={m.id} className={`chip${method === m.id ? ' on' : ''}`} onClick={() => setMethod(method === m.id ? null : m.id)}>
            {m.label}
          </button>
        ))}
      </div>

      {!descFocus && (
        <div className="keypad">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0'].map((k) => (
            <button key={k} className="key" onClick={() => press(k)}>{k}</button>
          ))}
          <button
            className="key"
            aria-label="Apagar"
            onClick={() => press('del')}
            onTouchStart={() => (holdTimer.current = window.setTimeout(() => setCents(0), 450))}
            onTouchEnd={() => clearTimeout(holdTimer.current)}
          >
            <IconDel />
          </button>
        </div>
      )}

      <div className="save-row">
        {editing && <button className="btn danger" onClick={remove} aria-label="Excluir"><IconTrash /></button>}
        <button className={`btn${kind === 'income' ? ' inc' : ''}`} disabled={!cents} onClick={submit}>
          {editing ? 'Salvar alterações' : kind === 'expense' ? 'Adicionar gasto' : 'Adicionar receita'}
        </button>
      </div>
    </Sheet>
  )
}
