import { useMemo } from 'react'
import { useStore, type Tx } from '../lib/store'
import { MonthSwitch } from '../components/MonthSwitch'
import { TxList } from '../components/TxList'
import { brl, brl0, daysInMonth, greeting, monthKey, monthLabel, shiftMonth } from '../lib/format'
import { byCategory, monthTxs, spentSince, startOfWeek, totals } from '../lib/stats'
import { summarize, useForecast, useOccurrences } from '../lib/usePlanned'
import { occStatus, type Occurrence } from '../lib/planned'
import { OccurrenceRow } from '../components/OccurrenceRow'

interface Props {
  month: string
  setMonth: (m: string) => void
  onOpen: (t: Tx) => void
  onAdd: () => void
  goTo: (tab: 'list' | 'insights' | 'settings', view?: 'txs' | 'planned') => void
  onOpenOcc: (o: Occurrence) => void
  onPay: (o: Occurrence) => void
  onNewPlanned: () => void
}

export function Home({ month, setMonth, onOpen, onAdd, goTo, onOpenOcc, onPay, onNewPlanned }: Props) {
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

  const occ = useOccurrences(month)
  const planExp = summarize(occ, 'expense')
  const planInc = summarize(occ, 'income')
  const hasPlanned = occ.length > 0
  const openOcc = occ
    .filter((o) => ['overdue', 'today', 'upcoming'].includes(occStatus(o)))
    .sort((a, b) => Number(occStatus(b) === 'overdue') - Number(occStatus(a) === 'overdue') || a.due.getTime() - b.due.getTime())
  const overdue = openOcc.filter((o) => occStatus(o) === 'overdue').length

  const f = useForecast(month)
  const lastDay = `${daysInMonth(month)}/${month.slice(5)}`
  const signed = (n: number) => `${n < 0 ? '−' : '+'}${brl(Math.abs(n))}`
  const heroValue = f.phase === 'future' ? f.willSpend : f.spent
  const [reais, cents] = brl(heroValue).replace('R$', '').trim().split(',')
  const breakdown = [
    f.spent > 0 && `${brl0(f.spent)} já gastos`,
    f.billsOpen > 0 && `${brl0(f.billsOpen)} em contas`,
    f.variableAhead >= 1 && `${brl0(f.variableAhead)} no seu ritmo atual`,
  ].filter(Boolean)

  // Limite opcional de gastos: compara com a previsão do mês
  const budget = profile?.monthly_budget ?? null
  const pct = budget ? (f.spent / budget) * 100 : 0
  const committedPct = budget ? Math.min(100 - Math.min(100, pct), ((f.willSpend - f.spent) / budget) * 100) : 0
  const projPct = budget ? (f.willSpend / budget) * 100 : 0

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
        <div className="label">
          {f.phase === 'future' ? `Vou gastar em ${monthLabel(month).toLowerCase()}` : `Gastei em ${monthLabel(month).toLowerCase()}`}
          {f.phase === 'current' && ' · até hoje'}
        </div>
        <div className="big">
          <small>R$ </small>{reais}<small>,{cents}</small>
        </div>
        <div className="hero-row">
          {f.phase === 'past' ? (
            <div className="hero-pill">
              <div className="k">Recebi</div>
              <div className="v">{brl(f.received)}</div>
            </div>
          ) : f.phase === 'future' ? (
            <div className="hero-pill">
              <div className="k">Vou receber</div>
              <div className="v">{brl(f.willReceive)}</div>
            </div>
          ) : (
            <div className="hero-pill">
              <div className="k">Vou gastar</div>
              <div className="v">{brl(f.willSpend)}</div>
              <div className="sub">até {lastDay}</div>
            </div>
          )}
          <div className={`hero-pill ${f.endBalance < 0 ? 'neg' : 'pos'}`}>
            <div className="k">{f.phase === 'past' ? (f.endBalance < 0 ? 'Faltou' : 'Sobrou') : 'Fim do mês'}</div>
            <div className="v">{signed(f.endBalance)}</div>
            {f.phase !== 'past' && <div className="sub">{f.endBalance < 0 ? 'vai faltar' : 'vai sobrar'}</div>}
          </div>
        </div>

        <div className="hero-notes">
          {f.phase === 'current' && breakdown.length > 1 && <div>= {breakdown.join(' + ')}</div>}
          {f.phase !== 'past' && (
            <div>
              Entrou {brl0(f.received)}
              {f.incomeOpen > 0 ? ` · a receber ${brl0(f.incomeOpen)}` : ''}
              {f.phase === 'current' ? ` · saldo hoje ${signed(f.balanceNow)}` : ''}
            </div>
          )}
          {f.phase === 'future' && <div>Só com as contas e receitas previstas</div>}
        </div>

        {budget ? (
          <div className="budget">
            <div className="budget-bar">
              <i className={projPct >= 100 ? 'over' : projPct >= 85 ? 'warn' : ''} style={{ width: `${Math.min(100, pct)}%` }} />
              {committedPct > 0 && <i className="committed" style={{ width: `${committedPct}%` }} />}
            </div>
            <div className="budget-txt">
              <span>Limite {brl0(budget)}</span>
              <span>{projPct >= 100 ? `previsão estoura ${brl0(f.willSpend - budget)}` : `previsão usa ${projPct.toFixed(0)}%`}</span>
            </div>
          </div>
        ) : null}
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

      <div className="section-h">
        <h2>Contas previstas</h2>
        <button onClick={() => goTo('list', 'planned')}>{hasPlanned ? 'Ver todas' : ''}</button>
      </div>
      {hasPlanned ? (
        <div className="card plan-card">
          <div className="plan-top">
            <div>
              <div className="k">Falta pagar</div>
              <div className="v">{brl(planExp.open)}</div>
              <div className="s">
                {planExp.openCount ? `${planExp.openCount} ${planExp.openCount === 1 ? 'conta' : 'contas'}` : 'Tudo pago 🎉'}
                {overdue > 0 && <span className="up"> · {overdue} atrasada{overdue > 1 ? 's' : ''}</span>}
              </div>
            </div>
            <div>
              {planInc.total > 0 ? (
                <>
                  <div className="k">A receber</div>
                  <div className="v" style={{ color: 'var(--green)' }}>{brl(planInc.open)}</div>
                  <div className="s">{planInc.open ? `de ${brl0(planInc.total)} previstos` : 'Tudo recebido 🎉'}</div>
                </>
              ) : (
                <>
                  <div className="k">Já pago</div>
                  <div className="v">{brl(planExp.paid)}</div>
                  <div className="s">de {brl0(planExp.total)}</div>
                </>
              )}
            </div>
          </div>
          {openOcc.length > 0 && (
            <div className="plan-list">
              {openOcc.slice(0, 4).map((o) => (
                <OccurrenceRow key={`${o.planned.id}-${o.month}`} o={o} onOpen={onOpenOcc} onPay={onPay} />
              ))}
              {openOcc.length > 4 && (
                <button className="more" onClick={() => goTo('list', 'planned')}>+ {openOcc.length - 4} contas</button>
              )}
            </div>
          )}
        </div>
      ) : (
        <button className="card plan-empty" onClick={onNewPlanned}>
          <span style={{ fontSize: 26 }}>🗓️</span>
          <span>
            <b>Cadastre contas fixas e seu salário</b>
            <br />
            Aluguel, internet, assinaturas e parcelas: veja quanto ainda vai sair no mês.
          </span>
        </button>
      )}

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
