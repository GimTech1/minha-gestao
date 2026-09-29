import { useMemo, useState } from 'react'
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
  goTo: (tab: 'list' | 'insights' | 'settings', view?: 'txs' | 'planned' | 'month' | 'future') => void
  onOpenOcc: (o: Occurrence) => void
  onPay: (o: Occurrence) => void
  onNewPlanned: () => void
  onBalance: () => void
}

export function Home({ month, setMonth, onOpen, onAdd, goTo, onOpenOcc, onPay, onNewPlanned, onBalance }: Props) {
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

  const occ = useOccurrences(month)
  const planExp = summarize(occ, 'expense')
  const planInc = summarize(occ, 'income')
  const hasPlanned = occ.length > 0
  const openOcc = occ
    .filter((o) => ['overdue', 'today', 'upcoming'].includes(occStatus(o)))
    .sort((a, b) => Number(occStatus(b) === 'overdue') - Number(occStatus(a) === 'overdue') || a.due.getTime() - b.due.getTime())
  const overdue = openOcc.filter((o) => occStatus(o) === 'overdue').length

  const f = useForecast(month)
  const a = f.allowance
  const [showCalc, setShowCalc] = useState(false)
  const lastDay = `${daysInMonth(month)}/${month.slice(5)}`
  const signed = (n: number) => `${n < 0 ? '−' : '+'}${brl(Math.abs(n))}`
  const signed0 = (n: number) => `${n < 0 ? '−' : '+'}${brl0(Math.abs(n))}`
  const paceRatio = a.perDay > 0 ? Math.min(1.25, a.pace / a.perDay) : 1.25
  const goalText = f.goal > 0 ? ` e guardar ${brl0(f.goal)}` : ''
  const needsData = a.verdict === 'no-balance' || a.verdict === 'no-income'
  const current = f.phase === 'current'
  const endShown = current ? a.endBalance : f.endBalance
  const todayBack = current ? a.free - (a.cash - f.billsOpen - f.goal) : 0
  const hasBalance = f.accountBalance != null

  const tone =
    f.phase === 'past' ? (f.endBalance >= 0 ? 'green' : 'red')
    : a.verdict === 'broke' ? 'red'
    : needsData ? 'neutral'
    : f.phase === 'future' ? 'violet'
    : a.verdict

  const chip =
    f.phase === 'past' ? (f.endBalance >= 0 ? '✅ Mês fechado no positivo' : '❌ Mês fechado no negativo')
    : a.verdict === 'no-balance' ? '💡 Me diga seu saldo em conta'
    : a.verdict === 'no-income' ? '💡 Falta cadastrar sua renda'
    : a.verdict === 'broke' ? '🔴 Sem folga agora'
    : f.phase === 'future' ? '📅 Previsão'
    : a.verdict === 'green' ? '🟢 Pode gastar mais'
    : a.verdict === 'yellow' ? '🟡 No limite'
    : '🔴 Segure os gastos'

  const message =
    f.phase === 'past' ? `${f.endBalance >= 0 ? 'Sobrou' : 'Faltou'} ${brl(Math.abs(f.endBalance))} de ${brl0(f.received)} que entraram.`
    : a.verdict === 'no-balance' ? 'Quanto você tem na conta hoje? O limite diário usa só o dinheiro que já está lá. O salário a receber entra quando cair.'
    : a.verdict === 'no-income' ? 'Cadastre seu salário em Previstos → A receber para eu prever este mês.'
    : a.verdict === 'broke'
      ? current
        ? `O que tem na conta não cobre as contas até ${lastDay}${f.goal > 0 ? ' e a meta' : ''}: faltam ${brl(Math.abs(a.free))}. Evite gastos até entrar dinheiro.`
        : `As contas${f.goal > 0 ? ' e a meta de guardar' : ''} passam do que entra em ${brl(Math.abs(a.free))}.`
    : f.phase === 'future' ? `Depois das contas${f.goal > 0 ? ' e da meta' : ''}, sobram ${brl0(a.free)} para o dia a dia.`
    : a.verdict === 'green' ? `Você gasta ${brl0(a.pace)}/dia e pode até ${brl0(a.perDay)}/dia${goalText}.`
    : a.verdict === 'yellow' ? `Seu ritmo (${brl0(a.pace)}/dia) está perto do limite de ${brl0(a.perDay)}/dia.`
    : `Você gasta ${brl0(a.pace)}/dia. Corte ${brl0(a.cutPerDay)}/dia para chegar em ${lastDay}${f.goal > 0 ? ` guardando ${brl0(f.goal)}` : ' sem ficar no negativo'}.`

  const heroBig = f.phase === 'past' ? Math.abs(f.endBalance) : Math.max(0, a.perDay)
  const [reais, cents] = brl(heroBig).replace('R$', '').trim().split(',')

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

      <div className={`hero tone-${tone}`}>
        <div className="verdict-chip">{chip}</div>

        {(!needsData || f.phase === 'past') && (
          <>
            <div className="label">
              {f.phase === 'past' ? (f.endBalance >= 0 ? 'Sobrou' : 'Faltou') : f.phase === 'future' ? 'Pode gastar por dia' : 'Você pode gastar'}
            </div>
            <div className="big">
              <small>R$ </small>{reais}<small>,{cents}</small>
              {f.phase !== 'past' && <small className="per">/dia</small>}
            </div>
            {current && a.verdict !== 'broke' && (
              <div className="hero-sub">até {lastDay} · {a.daysLeft} {a.daysLeft === 1 ? 'dia' : 'dias'} · {brl0(a.free)} livres</div>
            )}
          </>
        )}
        <p className="verdict-msg">{message}</p>
        {current && a.incoming > 0 && (
          <div className="incoming">💰 +{brl0(a.incoming)} a receber este mês · entra no limite quando cair</div>
        )}

        {a.verdict === 'no-balance' && (
          <button className="hero-cta" onClick={onBalance}>Informar saldo em conta</button>
        )}

        {current && !needsData && a.verdict !== 'broke' && (
          <div className="pace">
            <div className="pace-bar">
              <i style={{ width: `${(paceRatio / 1.25) * 100}%` }} />
              <b style={{ left: `${(1 / 1.25) * 100}%` }} />
            </div>
            <div className="pace-txt">
              <span>Seu ritmo {brl0(a.pace)}/dia</span>
              <span>Hoje ainda pode {brl0(a.leftToday)}</span>
            </div>
          </div>
        )}

        <div className="hero-row3">
          {f.phase === 'future' ? (
            <>
              <div><div className="k">Vai entrar</div><div className="v">{brl0(f.willReceive)}</div></div>
              <div><div className="k">Contas</div><div className="v">{brl0(f.billsOpen)}</div></div>
              <div><div className="k">Guardar</div><div className="v">{brl0(f.goal)}</div></div>
            </>
          ) : f.phase === 'past' ? (
            <>
              <div><div className="k">Entrou</div><div className="v">{brl0(f.received)}</div></div>
              <div><div className="k">Gastei</div><div className="v">{brl0(f.spent)}</div></div>
              <div>
                <div className="k">Meta</div>
                <div className="v">{f.goal > 0 ? (f.endBalance >= f.goal ? '✓ batida' : brl0(Math.max(0, f.endBalance))) : '—'}</div>
              </div>
            </>
          ) : (
            <>
              <div><div className="k">Gastei</div><div className="v">{brl0(f.spent)}</div></div>
              <div><div className="k">Vou gastar</div><div className="v">{brl0(f.willSpend)}</div></div>
              <div>
                <div className="k">{hasBalance ? 'Conta no fim' : 'Fim do mês'}</div>
                <div className={`v ${endShown < 0 ? 'neg' : 'pos'}`}>{signed0(endShown)}</div>
              </div>
            </>
          )}
        </div>

        {f.phase !== 'past' && !needsData && (
          <>
            <button className="calc-toggle" onClick={() => setShowCalc(!showCalc)}>
              {showCalc ? 'Esconder a conta ▴' : 'Como calculei ▾'}
            </button>
            {showCalc && (
              <div className="calc">
                {current ? (
                  hasBalance ? (
                    <div><span>Na conta hoje</span><span>{signed(a.cash)}</span></div>
                  ) : (
                    <>
                      <div><span>Entrou no mês</span><span>{brl(f.received)}</span></div>
                      <div><span>− Já gastei</span><span>{brl(f.spent)}</span></div>
                    </>
                  )
                ) : (
                  <div><span>Vai entrar no mês</span><span>{brl(f.willReceive)}</span></div>
                )}
                <div><span>− Contas a pagar{current ? ` até ${lastDay}` : ''}</span><span>{brl(f.billsOpen)}</span></div>
                {f.goal > 0 && <div><span>− Meta de guardar</span><span>{brl(f.goal)}</span></div>}
                {todayBack > 0 && (
                  <div className="dim"><span>+ Gastos de hoje (já descontados do limite de hoje)</span><span>{brl(todayBack)}</span></div>
                )}
                <div className="total"><span>= Livre para o dia a dia</span><span>{signed(a.free)}</span></div>
                {a.daysLeft > 0 && a.free > 0 && (
                  <div className="total"><span>÷ {a.daysLeft} dias</span><span>{brl(a.perDay)}/dia</span></div>
                )}
                {current && a.incoming > 0 && (
                  <div className="dim"><span>Fora do limite: a receber até {lastDay}</span><span>+{brl(a.incoming)}</span></div>
                )}
                {current && (
                  <div className="dim"><span>No ritmo atual, com o que vai entrar, fecha o mês com</span><span>{signed(endShown)}</span></div>
                )}
                {current && !hasBalance && (
                  <button className="text-btn" style={{ fontSize: 13, color: '#fff' }} onClick={onBalance}>
                    Informar saldo em conta para ficar exato →
                  </button>
                )}
              </div>
            )}
          </>
        )}

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

      {f.phase !== 'past' && f.willReceive <= 0 && (
        <button className="card plan-empty" style={{ marginTop: 12 }} onClick={onNewPlanned}>
          <span style={{ fontSize: 26 }}>💰</span>
          <span>
            <b>Cadastrar salário</b>
            <br />
            Escolha "A receber" e "Todo mês". Assim eu prevejo o fim do mês e os próximos meses.
          </span>
        </button>
      )}

      {current && !f.goal && !needsData && (
        <button className="goal-tip" onClick={() => goTo('settings')}>
          🎯 Defina quanto quer guardar por mês, e o limite diário já desconta isso →
        </button>
      )}

      <button className="goal-tip future-link" onClick={() => goTo('insights', 'future')}>
        📈 Ver próximos meses e o acumulado →
      </button>

      <div className="strip">
        <div className="stat">
          <div className="k">Hoje</div>
          <div className="v">{brl0(today)}</div>
        </div>
        <div className="stat">
          <div className="k">Semana</div>
          <div className="v">{brl0(week)}</div>
        </div>
        <button className="stat" style={{ textAlign: 'left' }} onClick={onBalance}>
          <div className="k">{hasBalance ? 'Na conta ✎' : 'Saldo do mês'}</div>
          <div className="v" style={{ color: (hasBalance ? a.cash : f.balanceNow) < 0 ? '#ffb3b3' : 'var(--green)' }}>
            {signed0(hasBalance ? a.cash : f.balanceNow)}
          </div>
        </button>
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
