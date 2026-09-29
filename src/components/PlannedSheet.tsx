import { useMemo, useState } from 'react'
import { Sheet } from './Sheet'
import { IconX } from './icons'
import { useStore, type Kind } from '../lib/store'
import { parseMoney, guessCategory } from '../lib/parser'
import { METHODS, brl, haptic, monthKey } from '../lib/format'
import { addMonths, monthStart, type PlanType, type Planned } from '../lib/planned'

interface Props {
  editing: Planned | null
  onClose: () => void
  notify: (msg: string) => void
}

const TYPES: Array<{ id: PlanType; label: string }> = [
  { id: 'monthly', label: '🔁 Todo mês' },
  { id: 'installments', label: '🧾 Parcelado' },
  { id: 'once', label: '📌 Uma vez' },
]

const moneyText = (n: number) => n.toFixed(2).replace('.', ',')

export function PlannedSheet({ editing, onClose, notify }: Props) {
  const { categories, savePlanned, deletePlanned } = useStore()
  const thisMonth = monthKey(new Date())

  const [kind, setKind] = useState<Kind>(editing?.kind ?? 'expense')
  const [description, setDescription] = useState(editing?.description ?? '')
  const [amount, setAmount] = useState(editing ? moneyText(editing.amount) : '')
  const [type, setType] = useState<PlanType>(editing?.type ?? 'monthly')
  const [day, setDay] = useState(editing?.day ?? new Date().getDate())
  const [startMonth, setStartMonth] = useState(editing ? editing.start_month.slice(0, 7) : thisMonth)
  const [installments, setInstallments] = useState(String(editing?.installments ?? 10))
  const [nextParcel, setNextParcel] = useState('1')
  const [onceDate, setOnceDate] = useState(
    editing?.type === 'once' ? `${editing.start_month.slice(0, 7)}-${String(editing.day).padStart(2, '0')}` : '',
  )
  const [categoryId, setCategoryId] = useState<string | null>(editing?.category_id ?? null)
  const [catTouched, setCatTouched] = useState(!!editing)
  const [method, setMethod] = useState<string | null>(editing?.method ?? null)
  const [busy, setBusy] = useState(false)
  const [paidThisMonth, setPaidThisMonth] = useState(true)
  const [tentative, setTentative] = useState(editing?.tentative ?? false)

  const cats = useMemo(() => categories.filter((c) => c.kind === kind), [categories, kind])
  const value = parseMoney(amount) ?? 0
  const n = Math.max(2, Math.min(480, Number(installments) || 0))
  const next = Math.max(1, Math.min(n, Number(nextParcel) || 1))

  const onDescription = (v: string) => {
    setDescription(v)
    if (!catTouched) {
      const g = guessCategory(v, kind, categories)
      if (g) setCategoryId(g.id)
    }
  }

  // Conta nova cujo vencimento deste mês já passou: provavelmente já foi paga por fora do app
  const dueAlreadyPassed = !editing && type === 'monthly' && startMonth === thisMonth && day < new Date().getDate()

  const valid = description.trim() && value > 0 && (type !== 'once' || onceDate)

  const save = async () => {
    if (!valid) return
    let start = startMonth
    let dueDay = day
    let skipped = editing?.skipped_months ?? []
    if (dueAlreadyPassed && paidThisMonth) start = addMonths(thisMonth, 1)
    if (type === 'once') {
      start = onceDate.slice(0, 7)
      dueDay = Number(onceDate.slice(8, 10))
    }
    if (type === 'installments' && !editing && next > 1) {
      // Compra já em andamento: a 1ª parcela foi há (next-1) meses; as anteriores ficam como puladas
      start = addMonths(startMonth, -(next - 1))
      skipped = Array.from({ length: next - 1 }, (_, i) => monthStart(addMonths(start, i)))
    }
    const fallback = cats.find((c) => /outros|entradas/i.test(c.name))
    const p: Planned = {
      id: editing?.id ?? crypto.randomUUID(),
      kind,
      amount: value,
      description: description.trim(),
      category_id: categoryId ?? fallback?.id ?? null,
      method,
      type,
      day: dueDay,
      start_month: monthStart(start),
      installments: type === 'installments' ? n : null,
      end_month: type === 'monthly' ? (editing?.end_month ?? null) : null,
      skipped_months: skipped,
      tentative,
    }
    setBusy(true)
    try {
      await savePlanned(p)
      haptic(20)
      notify(editing ? 'Conta atualizada' : `${p.description} adicionada às previstas`)
      onClose()
    } catch (e) {
      notify(`Erro: ${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  const stopRepeating = async () => {
    if (!editing) return
    if (!confirm(`Parar de repetir "${editing.description}"? Os meses anteriores continuam no histórico.`)) return
    await savePlanned({ ...editing, end_month: monthStart(addMonths(thisMonth, -1)) })
    notify('Não repete mais a partir deste mês')
    onClose()
  }

  const remove = async () => {
    if (!editing) return
    if (!confirm(`Excluir "${editing.description}" de todos os meses? Os lançamentos já pagos continuam no extrato.`)) return
    await deletePlanned(editing.id)
    notify('Conta prevista excluída')
    onClose()
  }

  return (
    <Sheet onClose={onClose}>
      <div className="sheet-h">
        <button className="icon-btn" onClick={onClose} aria-label="Fechar"><IconX /></button>
        <h3>{editing ? 'Editar conta prevista' : 'Nova conta prevista'}</h3>
        <button className="text-btn" onClick={save} disabled={!valid || busy}>Salvar</button>
      </div>

      <div className="seg" style={{ marginBottom: 14 }}>
        <button className={kind === 'expense' ? 'on exp' : ''} onClick={() => setKind('expense')}>A pagar</button>
        <button className={kind === 'income' ? 'on inc' : ''} onClick={() => setKind('income')}>A receber</button>
      </div>

      <label className="field">
        <span>Nome</span>
        <input
          className="input"
          value={description}
          onChange={(e) => onDescription(e.target.value)}
          placeholder={kind === 'expense' ? 'Aluguel, Netflix, Parcela do celular…' : 'Salário, Aluguel recebido…'}
          autoCapitalize="sentences"
        />
      </label>

      <div className="chips" style={{ margin: '0 -16px 12px' }}>
        {TYPES.map((t) => (
          <button key={t.id} className={`chip${type === t.id ? ' on' : ''}`} onClick={() => setType(t.id)}>{t.label}</button>
        ))}
      </div>

      <div className="grid2">
        <label className="field">
          <span>{type === 'installments' ? 'Valor da parcela' : 'Valor'} (R$)</span>
          <input className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" />
        </label>
        {type === 'once' ? (
          <label className="field">
            <span>Data</span>
            <input className="input" type="date" value={onceDate} onChange={(e) => setOnceDate(e.target.value)} />
          </label>
        ) : (
          <label className="field">
            <span>Vence todo dia</span>
            <select className="input" value={day} onChange={(e) => setDay(Number(e.target.value))}>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      {type === 'installments' && (
        <>
          <div className="grid2">
            <label className="field">
              <span>Nº de parcelas</span>
              <input className="input" inputMode="numeric" value={installments} onChange={(e) => setInstallments(e.target.value.replace(/\D/g, ''))} />
            </label>
            {!editing && (
              <label className="field">
                <span>Próxima parcela é a</span>
                <input className="input" inputMode="numeric" value={nextParcel} onChange={(e) => setNextParcel(e.target.value.replace(/\D/g, ''))} />
              </label>
            )}
          </div>
          {value > 0 && (
            <p className="muted" style={{ fontSize: 13, margin: '-4px 4px 12px' }}>
              Total: {brl(value * n)} · faltam {n - next + 1} de {n} ({brl(value * (n - next + 1))})
            </p>
          )}
        </>
      )}

      {dueAlreadyPassed && (
        <button className={`toggle-row${paidThisMonth ? ' on' : ''}`} onClick={() => setPaidThisMonth(!paidThisMonth)}>
          <span className="box">{paidThisMonth ? '✓' : ''}</span>
          <span>
            <b>Já paguei a deste mês</b>
            <br />
            <span className="muted">O dia {day} já passou. {paidThisMonth ? 'Começa a contar no mês que vem.' : 'Vai aparecer como atrasada.'}</span>
          </span>
        </button>
      )}

      {type !== 'once' && !editing && !dueAlreadyPassed && (
        <label className="field">
          <span>{type === 'installments' ? 'Mês da próxima parcela' : 'Começa em'}</span>
          <input className="input" type="month" value={startMonth} onChange={(e) => e.target.value && setStartMonth(e.target.value)} />
        </label>
      )}

      <button className={`toggle-row${tentative ? ' on' : ''}`} onClick={() => setTentative(!tentative)}>
        <span className="box">{tentative ? '✓' : ''}</span>
        <span>
          <b>Possível, não garantido</b>
          <br />
          <span className="muted">
            Fica fora do disponível por dia. Aparece no cenário "com os possíveis" para você planejar.
          </span>
        </span>
      </button>

      <div className="field">
        <span>Categoria</span>
        <div className="cat-grid" style={{ marginTop: 0 }}>
          {cats.map((c) => (
            <button
              key={c.id}
              className={`cat-chip${c.id === categoryId ? ' on' : ''}`}
              style={{ '--c': c.color } as React.CSSProperties}
              onClick={() => {
                setCategoryId(c.id === categoryId ? null : c.id)
                setCatTouched(true)
              }}
            >
              <span className="e">{c.emoji}</span>
              <span className="n">{c.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span>Forma de pagamento</span>
        <div className="chips" style={{ marginTop: 0 }}>
          {METHODS.map((m) => (
            <button key={m.id} className={`chip${method === m.id ? ' on' : ''}`} onClick={() => setMethod(method === m.id ? null : m.id)}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <button className={`btn${kind === 'income' ? ' inc' : ''}`} style={{ width: '100%', marginTop: 4 }} onClick={save} disabled={!valid || busy}>
        {editing ? 'Salvar alterações' : 'Adicionar conta prevista'}
      </button>

      {editing && (
        <div className="save-row">
          {editing.type === 'monthly' && !editing.end_month && (
            <button className="btn ghost" onClick={stopRepeating}>Parar de repetir</button>
          )}
          <button className="btn ghost" style={{ color: 'var(--red)' }} onClick={remove}>Excluir</button>
        </div>
      )}
    </Sheet>
  )
}
