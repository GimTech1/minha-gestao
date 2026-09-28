import { useMemo, useState } from 'react'
import { useStore, type Tx } from '../lib/store'
import { MonthSwitch } from '../components/MonthSwitch'
import { TxList } from '../components/TxList'
import { IconSearch, IconX } from '../components/icons'
import { brl } from '../lib/format'
import { monthTxs, totals } from '../lib/stats'

const norm = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

export function History({ month, setMonth, onOpen }: { month: string; setMonth: (m: string) => void; onOpen: (t: Tx) => void }) {
  const { txs, categories, catById } = useStore()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<string>('all') // all | expense | income | <categoryId>

  const list = useMemo(() => {
    // Com busca, procura em todos os meses
    const base = q.trim() ? txs : monthTxs(txs, month)
    const nq = norm(q.trim())
    return base.filter((t) => {
      if (filter === 'expense' || filter === 'income') {
        if (t.kind !== filter) return false
      } else if (filter !== 'all' && t.category_id !== filter) return false
      if (!nq) return true
      const c = t.category_id ? catById.get(t.category_id) : undefined
      const amount = t.amount.toFixed(2).replace('.', ',')
      return norm(`${t.description ?? ''} ${c?.name ?? ''} ${amount}`).includes(nq)
    })
  }, [txs, month, q, filter, catById])

  const t = totals(list)
  const usedCats = useMemo(() => {
    const ids = new Set(monthTxs(txs, month).map((x) => x.category_id))
    return categories.filter((c) => ids.has(c.id))
  }, [txs, month, categories])

  return (
    <div className="screen">
      <div className="topbar">
        <h1>Extrato</h1>
        {!q && <MonthSwitch month={month} setMonth={setMonth} />}
      </div>

      <div className="search">
        <IconSearch />
        <input placeholder="Buscar em todos os meses" value={q} onChange={(e) => setQ(e.target.value)} enterKeyHint="search" />
        {q && <button onClick={() => setQ('')} aria-label="Limpar"><IconX /></button>}
      </div>

      <div className="chips" style={{ marginTop: 0 }}>
        <button className={`chip${filter === 'all' ? ' on' : ''}`} onClick={() => setFilter('all')}>Todos</button>
        <button className={`chip${filter === 'expense' ? ' on' : ''}`} onClick={() => setFilter('expense')}>Gastos</button>
        <button className={`chip${filter === 'income' ? ' on' : ''}`} onClick={() => setFilter('income')}>Receitas</button>
        {usedCats.map((c) => (
          <button key={c.id} className={`chip${filter === c.id ? ' on' : ''}`} onClick={() => setFilter(filter === c.id ? 'all' : c.id)}>
            {c.emoji} {c.name}
          </button>
        ))}
      </div>

      <div className="strip" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="stat">
          <div className="k">Saídas</div>
          <div className="v">{brl(t.expense)}</div>
        </div>
        <div className="stat">
          <div className="k">Entradas</div>
          <div className="v" style={{ color: 'var(--green)' }}>{brl(t.income)}</div>
        </div>
      </div>

      {list.length ? (
        <TxList txs={list} onOpen={onOpen} />
      ) : (
        <div className="card empty" style={{ marginTop: 12 }}>
          <span className="e">🔎</span>
          Nada por aqui.
        </div>
      )}
    </div>
  )
}
