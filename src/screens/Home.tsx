import { useMemo } from 'react'
import { useStore, type Tx } from '../lib/store'
import { MonthSwitch } from '../components/MonthSwitch'
import { TxList } from '../components/TxList'
import { brl, brl0, daysInMonth, greeting, monthKey, monthLabel, shiftMonth } from '../lib/format'
import { byCategory, monthTxs, spentSince, startOfWeek, totals } from '../lib/stats'

interface Props {
  month: string
  setMonth: (m: string) => void
  onOpen: (t: Tx) => void
  onAdd: () => void
  goTo: (tab: 'list' | 'insights' | 'settings') => void
}

export function Home({ month, setMonth, onOpen, onAdd, goTo }: Props) {
  const { txs, profile, catById, syncing, pending } = useStore()

  const mTxs = useMemo(() => monthTxs(txs, month), [txs, month])
  const prevTxs = useMemo(() => monthTxs(txs, shiftMonth(month, -1)), [txs, month])
  const t = totals(mTxs)
  const cats = useMemo(() => byCategory(mTxs, catById), [mTxs, catById])
  const prevCats = useMemo(() => new Map(byCategory(prevTxs, catById).map((c) => [c.id, c.total])), [prevTxs, catById])

  const isCurrent = month === monthKey(new Date())
  const now = new Date()
  const today = spentSince(txs, new Date(now.getFullYear(), now.getMonth(), now.getDate()))
  const week = spentSince(txs, startOfWeek())
  const daysElapsed = isCurrent ? now.getDate() : daysInMonth(month)
  const avg = t.expense / Math.max(1, daysElapsed)

  const budget = profile?.monthly_budget ?? null
  const pct = budget ? (t.expense / budget) * 100 : 0
  const remaining = budget ? budget - t.expense : 0
  const daysLeft = daysInMonth(month) - now.getDate() + 1
  const perDay = remaining > 0 && isCurrent ? remaining / daysLeft : 0

  const [reais, cents] = brl(t.expense).replace('R$', '').trim().split(',')
  const firstName = (profile?.name ?? '').split(' ')[0]

  return (
    <div className="screen">
      <div className="topbar">
        <div>
          <div className="hello">
            {greeting()}{firstName ? `, ${firstName}` : ''} 👋
            <span className={`sync-dot${pending ? ' off' : ''}`} style={{ opacity: syncing || pending ? 1 : 0 }} />
          </div>
          <h1>Resumo</h1>
        </div>
        <MonthSwitch month={month} setMonth={setMonth} />
      </div>

      <div className="hero">
        <div className="label">Gastos em {monthLabel(month).toLowerCase()}</div>
        <div className="big">
          <small>R$ </small>{reais}<small>,{cents}</small>
        </div>
        <div className="hero-row">
          <div className="hero-pill">
            <div className="k">Receitas</div>
            <div className="v">{brl(t.income)}</div>
          </div>
          <div className="hero-pill">
            <div className="k">Saldo</div>
            <div className="v">{t.balance < 0 ? '−' : ''}{brl(Math.abs(t.balance))}</div>
          </div>
        </div>
        {budget ? (
          <div className="budget">
            <div className="budget-bar">
              <i className={pct >= 100 ? 'over' : pct >= 80 ? 'warn' : ''} style={{ width: `${Math.min(100, pct)}%` }} />
            </div>
            <div className="budget-txt">
              <span>{pct.toFixed(0)}% de {brl0(budget)}</span>
              <span>
                {remaining >= 0
                  ? `Restam ${brl0(remaining)}${perDay ? ` · ${brl0(perDay)}/dia` : ''}`
                  : `Estourou ${brl0(-remaining)}`}
              </span>
            </div>
          </div>
        ) : (
          <button className="budget-txt" style={{ marginTop: 12, position: 'relative', zIndex: 1 }} onClick={() => goTo('settings')}>
            <span>🎯 Definir orçamento mensal →</span>
          </button>
        )}
      </div>

      <div className="strip">
        <div className="stat">
          <div className="k">Hoje</div>
          <div className="v">{brl0(today)}</div>
        </div>
        <div className="stat">
          <div className="k">Semana</div>
          <div className="v">{brl0(week)}</div>
        </div>
        <div className="stat">
          <div className="k">Média/dia</div>
          <div className="v">{brl0(avg)}</div>
        </div>
      </div>

      {cats.length > 0 && (
        <>
          <div className="section-h">
            <h2>Para onde foi</h2>
            <button onClick={() => goTo('insights')}>Análise</button>
          </div>
          <div className="card">
            <div className="stack">
              {cats.map((c) => (
                <i key={c.id} style={{ width: `${(c.total / t.expense) * 100}%`, background: c.color }} title={c.name} />
              ))}
            </div>
            {cats.slice(0, 5).map((c) => {
              const prev = prevCats.get(c.id) ?? 0
              const delta = prev ? ((c.total - prev) / prev) * 100 : null
              return (
                <div key={c.id} className="cat-line">
                  <span className="ico" style={{ background: `color-mix(in srgb, ${c.color} 22%, transparent)` }}>{c.emoji}</span>
                  <div className="mid">
                    <div className="name">
                      <span>{c.name}</span>
                      <span>{brl(c.total)}</span>
                    </div>
                    <div className="bar"><i style={{ width: `${(c.total / cats[0].total) * 100}%`, background: c.color }} /></div>
                    <div className="sub">
                      <span>{((c.total / t.expense) * 100).toFixed(0)}% · {c.count} {c.count === 1 ? 'lançamento' : 'lançamentos'}</span>
                      {delta != null && Math.abs(delta) >= 1 && (
                        <span className={delta > 0 ? 'up' : 'down'}>
                          {delta > 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(0)}% vs mês ant.
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      <div className="section-h">
        <h2>Recentes</h2>
        {mTxs.length > 0 && <button onClick={() => goTo('list')}>Ver tudo</button>}
      </div>
      {mTxs.length ? (
        <TxList txs={mTxs} onOpen={onOpen} limitDays={4} />
      ) : (
        <div className="card empty">
          <span className="e">🪙</span>
          Nenhum lançamento em {monthLabel(month).toLowerCase()}.
          {isCurrent && (
            <>
              <br />
              <button className="text-btn" onClick={onAdd}>Adicionar o primeiro gasto</button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
