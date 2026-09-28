import { useStore, type Tx } from '../lib/store'
import { brl, dayKey, dayLabel, methodLabel, timeLabel } from '../lib/format'

export function TxList({ txs, onOpen, limitDays }: { txs: Tx[]; onOpen: (t: Tx) => void; limitDays?: number }) {
  const { catById } = useStore()

  const groups: Array<{ key: string; items: Tx[]; total: number }> = []
  for (const t of txs) {
    const key = dayKey(new Date(t.occurred_at))
    let g = groups[groups.length - 1]
    if (!g || g.key !== key) {
      if (limitDays && groups.length >= limitDays) break
      g = { key, items: [], total: 0 }
      groups.push(g)
    }
    g.items.push(t)
    g.total += t.kind === 'expense' ? -t.amount : t.amount
  }

  return (
    <>
      {groups.map((g) => (
        <div key={g.key}>
          <div className="day-h">
            <span>{dayLabel(g.key)}</span>
            <span>{g.total < 0 ? '−' : '+'}{brl(Math.abs(g.total))}</span>
          </div>
          <div className="tx-group">
            {g.items.map((t) => {
              const c = t.category_id ? catById.get(t.category_id) : undefined
              const meta = [c?.name ?? 'Sem categoria', methodLabel(t.method), timeLabel(t.occurred_at)].filter(Boolean).join(' · ')
              return (
                <button key={t.id} className="tx" onClick={() => onOpen(t)}>
                  <span className="ico" style={{ background: `color-mix(in srgb, ${c?.color ?? '#8b8b9e'} 22%, transparent)` }}>
                    {c?.emoji ?? '💸'}
                  </span>
                  <span className="mid">
                    <div className="title">{t.description || c?.name || (t.kind === 'income' ? 'Receita' : 'Gasto')}</div>
                    <div className="meta">
                      {t.source === 'auto' && <span className="badge">AUTO</span>}
                      <span>{meta}</span>
                    </div>
                  </span>
                  <span className={`amt${t.kind === 'income' ? ' in' : ''}`}>
                    {t.kind === 'income' ? '+' : '−'}{brl(t.amount)}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </>
  )
}
