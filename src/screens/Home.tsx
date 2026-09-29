import { useMemo, useState } from 'react'
import { useStore, type Tx } from '../lib/store'
import { MonthSwitch } from '../components/MonthSwitch'
import { TxList } from '../components/TxList'
import { brl, brl0, cap, daysInMonth, monthKey, monthLabel, shiftMonth } from '../lib/format'
import { IconNext } from '../components/icons'
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
  const needsData = a.verdict === 'no-balance' || a.verdict === 'no-income'
  const current = f.phase === 'current'
  const endShown = current ? a.endBalance : f.endBalance
  const todayBack = current ? a.free - (a.cash - a.reserved - f.billsOpen - f.goal) : 0
  const hasBalance = f.accountBalance != null

  const ddmm = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  const bindingLater = !!a.binding && a.binding.date.getMonth() !== new Date().getMonth()
  const bindingMonth = a.binding ? cap(a.binding.date.toLocaleDateString('pt-BR', { month: 'long' })) : ''
  const todayBackLook = a.binding ? a.free - (a.cash + a.binding.inflow - a.binding.outflow - a.binding.goals) : 0

  const status: { tone: string; label: string } =
    f.phase === 'past' ? (f.endBalance >= 0 ? { tone: 'ok', label: 'Positivo' } : { tone: 'bad', label: 'Negativo' })
    : a.verdict === 'no-balance' ? { tone: 'muted', label: 'Saldo não informado' }
    : a.verdict === 'no-income' ? { tone: 'muted', label: 'Sem receita prevista' }
    : a.verdict === 'broke' ? { tone: 'bad', label: 'Sem saldo disponível' }
    : f.phase === 'future' ? { tone: 'muted', label: 'Previsão' }
    : a.verdict === 'green' ? { tone: 'ok', label: 'Dentro do limite' }
    : a.verdict === 'yellow' ? { tone: 'warn', label: 'Próximo do limite' }
    : { tone: 'bad', label: 'Acima do limite' }

  const note =
    f.phase === 'past' ? `Receitas de ${brl(f.received)} menos despesas de ${brl(f.spent)}.`
    : a.verdict === 'no-balance' ? 'Informe o saldo atual da conta para calcular quanto está disponível por dia. Receitas a receber só entram depois de creditadas.'
    : a.verdict === 'no-income' ? 'Cadastre suas receitas em Previstos para projetar este mês.'
    : a.verdict === 'broke'
      ? current
        ? `As contas até ${lastDay}${f.goal > 0 ? ' e a meta de economia' : ''} superam o saldo em ${brl(Math.abs(a.free))}.`
        : `As contas${f.goal > 0 ? ' e a meta de economia' : ''} superam as receitas previstas em ${brl(Math.abs(a.free))}.`
    : f.phase === 'future' ? `${brl(a.free)} disponíveis no mês após contas${f.goal > 0 ? ' e meta' : ''}.`
    : a.verdict === 'red' ? `Reduza ${brl(a.cutPerDay)} por dia para a conta não ficar negativa${a.binding ? ` até ${ddmm(a.binding.date)}` : ''}.`
    : bindingLater ? `${bindingMonth} é o período mais apertado. O limite diário já reserva o necessário para ele.`
    : null

  const heroValue = f.phase === 'past' ? f.endBalance : Math.max(0, a.perDay)
  const [reais, cents] = brl(Math.abs(heroValue)).replace('R$', '').trim().split(',')

  // Limite opcional de gastos: compara com a previsão do mês
  const budget = profile?.monthly_budget ?? null
  const projPct = budget ? (f.willSpend / budget) * 100 : 0

  const todayLabel = new Date().toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'long' }).replace('.', '')

  return (
    <div className="screen">
      <div className="topbar">
        <div>
          <div className="hello">
            {cap(todayLabel)}
            <span className={`sync-dot${pending ? ' off' : ''}`} style={{ opacity: syncing || pending ? 1 : 0 }} />
          </div>
          <h1>Resumo</h1>
        </div>
        <MonthSwitch month={month} setMonth={setMonth} />
      </div>

      <section className="sum">
        <div className="sum-head">
          <span className="sum-label">
            {f.phase === 'past' ? 'Resultado do mês' : f.phase === 'future' ? 'Disponível por dia (previsão)' : 'Disponível por dia'}
          </span>
          <span className={`status ${status.tone}`}><i />{status.label}</span>
        </div>

        {!needsData || f.phase === 'past' ? (
          <div className={`sum-value${f.phase === 'past' ? (f.endBalance < 0 ? ' bad' : ' ok') : ''}`}>
            {f.phase === 'past' && (f.endBalance < 0 ? '−' : '+')}
            <span className="cur">R$</span>{reais}<span className="cents">,{cents}</span>
            {f.phase !== 'past' && <span className="per">/dia</span>}
          </div>
        ) : (
          <div className="sum-value empty">—</div>
        )}

        {current && !needsData && a.verdict !== 'broke' && (
          <div className="sum-sub">
            {a.binding && bindingLater ? 'Considerando as contas até' : 'Até'} {a.binding ? ddmm(a.binding.date) : lastDay} · {a.daysLeft} {a.daysLeft === 1 ? 'dia' : 'dias'} · {brl(a.free)} disponíveis
          </div>
        )}
        {note && <p className="sum-note">{note}</p>}
        {a.verdict === 'no-balance' && (
          <button className="btn sum-cta" onClick={onBalance}>Informar saldo em conta</button>
        )}

        {current && !needsData && a.verdict !== 'broke' && (
          <div className="meter">
            <div className="meter-track">
              <i className={status.tone} style={{ width: `${(paceRatio / 1.25) * 100}%` }} />
              <b style={{ left: `${(1 / 1.25) * 100}%` }} />
            </div>
            <div className="meter-legend">
              <span>Média diária {brl(a.pace)}</span>
              <span>Disponível hoje {brl(a.leftToday)}</span>
            </div>
          </div>
        )}

        <div className="sum-grid">
          {f.phase === 'future' ? (
            <>
              <div><span>Receitas previstas</span><b>{brl0(f.willReceive)}</b></div>
              <div><span>Contas previstas</span><b>{brl0(f.billsOpen)}</b></div>
              <div><span>Meta de economia</span><b>{f.goal ? brl0(f.goal) : '—'}</b></div>
            </>
          ) : f.phase === 'past' ? (
            <>
              <div><span>Receitas</span><b>{brl0(f.received)}</b></div>
              <div><span>Despesas</span><b>{brl0(f.spent)}</b></div>
              <div><span>Meta</span><b>{f.goal > 0 ? (f.endBalance >= f.goal ? 'Atingida' : 'Não atingida') : '—'}</b></div>
            </>
          ) : (
            <>
              <div><span>Gasto no mês</span><b>{brl0(f.spent)}</b></div>
              <div><span>Previsão do mês</span><b>{brl0(f.willSpend)}</b></div>
              <div>
                <span>{hasBalance ? 'Saldo previsto' : 'Resultado previsto'}</span>
                <b className={endShown < 0 ? 'bad' : ''}>{signed0(endShown)}</b>
              </div>
            </>
          )}
        </div>

        {current && (a.incoming > 0 || a.reserved > 0 || budget || (a.binding && !needsData) || f.possible) ? (
          <div className="sum-rows">
            {a.binding && !needsData && (
              <div>
                <span>Projeção no ritmo atual<small>Média de {brl(a.pace)} por dia</small></span>
                <b className={a.firstNegative ? 'bad' : 'good'}>
                  {a.firstNegative ? `Negativa em ${ddmm(a.firstNegative.date)}` : `Positiva até ${a.horizonEnd ? `${a.horizonEnd.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}/${a.horizonEnd.getFullYear()}` : ''}`}
                </b>
              </div>
            )}
            {f.possible && !needsData && (
              <div>
                <span>
                  Com os valores possíveis
                  <small>
                    {f.possible.inflow ? `+${brl0(f.possible.inflow)}` : ''}
                    {f.possible.inflow && f.possible.outflow ? ' · ' : ''}
                    {f.possible.outflow ? `−${brl0(f.possible.outflow)}` : ''} em 6 meses
                    {f.possible.firstNegative ? ` · negativa em ${ddmm(f.possible.firstNegative.date)}` : ''}
                  </small>
                </span>
                <b className={(f.possible.perDay ?? 0) <= 0 ? 'bad' : ''}>{brl(Math.max(0, f.possible.perDay ?? 0))}/dia</b>
              </div>
            )}
            {a.incoming > 0 && (
              <div><span>A receber até {lastDay}<small>{a.binding ? 'Considerado a partir da data em que cai' : 'Não incluído no disponível'}</small></span><b>{brl(a.incoming)}</b></div>
            )}
            {a.reserved > 0 && (
              <div><span>Receita do próximo mês já creditada<small>Reservada para o próximo mês</small></span><b>{brl(a.reserved)}</b></div>
            )}
            {budget ? (
              <div>
                <span>Limite de gastos<small>{projPct >= 100 ? `Previsão excede em ${brl0(f.willSpend - budget)}` : `Previsão usa ${projPct.toFixed(0)}%`}</small></span>
                <b>{brl0(budget)}</b>
              </div>
            ) : null}
          </div>
        ) : null}

        {f.phase !== 'past' && !needsData && (
          <>
            <button className="sum-toggle" onClick={() => setShowCalc(!showCalc)}>
              {showCalc ? 'Ocultar cálculo' : 'Detalhar cálculo'}
            </button>
            {showCalc && (
              <div className="calc-table">
                {current && a.binding ? (
                  <>
                    <div><span>{hasBalance ? 'Saldo em conta' : 'Receitas menos despesas do mês'}</span><span>{signed(a.cash)}</span></div>
                    <div><span>Receitas previstas até {ddmm(a.binding.date)}</span><span>+{brl(a.binding.inflow)}</span></div>
                    <div><span>Contas previstas até {ddmm(a.binding.date)}</span><span>−{brl(a.binding.outflow)}</span></div>
                    {a.binding.goals > 0 && <div><span>Metas de economia até {ddmm(a.binding.date)}</span><span>−{brl(a.binding.goals)}</span></div>}
                    {todayBackLook > 0.005 && <div className="dim"><span>Gastos de hoje (descontados do disponível de hoje)</span><span>+{brl(todayBackLook)}</span></div>}
                    <div className="total"><span>Disponível até {ddmm(a.binding.date)}</span><span>{signed(a.free)}</span></div>
                    {a.free > 0 && <div className="total"><span>Por dia ({a.binding.days} dias)</span><span>{brl(a.perDay)}</span></div>}
                    <div className="dim"><span>Checado em cada vencimento dos próximos 6 meses; esta é a data mais restritiva.</span><span /></div>
                  </>
                ) : current ? (
                  hasBalance ? (
                    <div><span>Saldo em conta</span><span>{signed(a.cash)}</span></div>
                  ) : (
                    <>
                      <div><span>Receitas do mês</span><span>{brl(f.received)}</span></div>
                      <div><span>Despesas do mês</span><span>−{brl(f.spent)}</span></div>
                    </>
                  )
                ) : (
                  <div><span>Receitas previstas</span><span>{brl(f.willReceive)}</span></div>
                )}
                {!a.binding && (
                  <>
                    {a.reserved > 0 && <div><span>Receita reservada para o próximo mês</span><span>−{brl(a.reserved)}</span></div>}
                    <div><span>Contas a pagar{current ? ` até ${lastDay}` : ''}</span><span>−{brl(f.billsOpen)}</span></div>
                    {f.goal > 0 && <div><span>Meta de economia</span><span>−{brl(f.goal)}</span></div>}
                    {todayBack > 0 && <div className="dim"><span>Gastos de hoje (descontados do disponível de hoje)</span><span>+{brl(todayBack)}</span></div>}
                    <div className="total"><span>Disponível</span><span>{signed(a.free)}</span></div>
                    {a.daysLeft > 0 && a.free > 0 && (
                      <div className="total"><span>Por dia ({a.daysLeft} {a.daysLeft === 1 ? 'dia' : 'dias'})</span><span>{brl(a.perDay)}</span></div>
                    )}
                  </>
                )}
                {current && (
                  <div className="dim"><span>Saldo previsto no fim deste mês, mantida a média diária e somadas as receitas</span><span>{signed(endShown)}</span></div>
                )}
              </div>
            )}
          </>
        )}
      </section>

      {f.phase !== 'past' && f.willReceive <= 0 && (
        <button className="card plan-empty" onClick={onNewPlanned}>
          <span>
            <b>Cadastrar receita mensal</b>
            <br />
            Em Previstos, escolha "A receber" e "Todo mês" para projetar os próximos meses.
          </span>
          <span className="chev"><IconNext /></span>
        </button>
      )}

      <div className="strip">
        <div className="stat">
          <div className="k">Gasto hoje</div>
          <div className="v">{brl0(today)}</div>
        </div>
        <div className="stat">
          <div className="k">Na semana</div>
          <div className="v">{brl0(week)}</div>
        </div>
        <button className="stat" style={{ textAlign: 'left' }} onClick={onBalance}>
          <div className="k">{hasBalance ? 'Em conta' : 'Saldo do mês'}</div>
          <div className={`v${(hasBalance ? a.cash : f.balanceNow) < 0 ? ' bad' : ''}`}>{signed0(hasBalance ? a.cash : f.balanceNow)}</div>
        </button>
      </div>

      <div className="list links">
        <button className="row" onClick={() => goTo('insights', 'future')}>
          <div className="grow">
            <div className="t">Próximos meses</div>
            <div className="s">Saldo previsto e acumulado</div>
          </div>
          <span className="chev"><IconNext /></span>
        </button>
        <button className="row" onClick={() => goTo('settings')}>
          <div className="grow">
            <div className="t">Meta de economia</div>
            <div className="s">{f.goal > 0 ? `${brl(f.goal)} por mês` : 'Não definida'}</div>
          </div>
          <span className="chev"><IconNext /></span>
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
                {planExp.openCount ? `${planExp.openCount} ${planExp.openCount === 1 ? 'conta' : 'contas'}` : 'Nenhuma pendente'}
                {overdue > 0 && <span className="up"> · {overdue} atrasada{overdue > 1 ? 's' : ''}</span>}
              </div>
            </div>
            <div>
              {planInc.total > 0 ? (
                <>
                  <div className="k">A receber</div>
                  <div className="v" style={{ color: 'var(--green)' }}>{brl(planInc.open)}</div>
                  <div className="s">{planInc.open ? `de ${brl0(planInc.total)} previstos` : 'Tudo recebido'}</div>
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
          <span>
            <b>Cadastrar contas previstas</b>
            <br />
            Aluguel, financiamentos, assinaturas, parcelas e receitas.
          </span>
          <span className="chev"><IconNext /></span>
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
