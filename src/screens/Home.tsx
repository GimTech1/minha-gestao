import { useMemo, useState } from 'react'
import { useStore, type Tx } from '../lib/store'
import { MonthSwitch } from '../components/MonthSwitch'
import { TxList } from '../components/TxList'
import { brl, brl0, cap, daysInMonth, monthKey, monthLabel, shiftMonth } from '../lib/format'
import { IconAlert, IconCalendar, IconCheck, IconDown, IconInfo, IconNext, IconTarget, IconTrend, IconWallet, IconX } from '../components/icons'
import { Ring } from '../components/Ring'
import { BalanceChart } from '../components/BalanceChart'
import { Sheet } from '../components/Sheet'
import { byCategory, monthTxs, totals } from '../lib/stats'
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
  const needsData = a.verdict === 'no-balance' || a.verdict === 'no-income'
  const current = f.phase === 'current'
  const endShown = current ? a.endBalance : f.endBalance
  const todayBack = current ? a.free - (a.cash - a.reserved - f.billsOpen - f.goal) : 0
  const hasBalance = f.accountBalance != null
  const [showPossible, setShowPossible] = useState(false)

  const ddmm = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  const bindingLater = !!a.binding && a.binding.date.getMonth() !== new Date().getMonth()
  const bindingMonth = a.binding ? cap(a.binding.date.toLocaleDateString('pt-BR', { month: 'long' })) : ''
  const todayBackLook = a.binding ? a.free - (a.cash + a.binding.inflow - a.binding.outflow - a.binding.goals) : 0
  const spentTodayVar = Math.max(0, a.perDay - a.leftToday)
  const perDayShown = showPossible && f.possible?.perDay != null ? f.possible.perDay : a.perDay
  const leftShown = Math.max(0, perDayShown - spentTodayVar)

  const status: { tone: string; label: string } =
    f.phase === 'past' ? (f.endBalance >= 0 ? { tone: 'ok', label: 'Positivo' } : { tone: 'bad', label: 'Negativo' })
    : a.verdict === 'no-balance' ? { tone: 'muted', label: 'Informe o saldo' }
    : a.verdict === 'no-income' ? { tone: 'muted', label: 'Sem receita' }
    : a.verdict === 'broke' ? { tone: 'bad', label: 'Sem folga' }
    : f.phase === 'future' ? { tone: 'muted', label: 'Previsão' }
    : a.verdict === 'green' ? { tone: 'ok', label: 'Tranquilo' }
    : a.verdict === 'yellow' ? { tone: 'warn', label: 'No limite' }
    : { tone: 'bad', label: 'Acima do limite' }
  const StatusIcon = status.tone === 'ok' ? IconCheck : status.tone === 'muted' ? IconInfo : IconAlert

  const [reais, cents] = brl(Math.max(0, perDayShown)).replace('R$', '').trim().split(',')
  const [pReais, pCents] = brl(Math.abs(f.endBalance)).replace('R$', '').trim().split(',')

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

      <section className={`today tone-${status.tone}`}>
        <div className="today-top">
          {f.phase === 'past' ? (
            <div className="past-result">
              <span className="k">Resultado do mês</span>
              <div className={`big ${f.endBalance < 0 ? 'bad' : 'ok'}`}>
                {f.endBalance < 0 ? '−' : '+'}<small>R$</small>{pReais}<small>,{pCents}</small>
              </div>
            </div>
          ) : (
            <Ring value={current ? spentTodayVar : 0} max={perDayShown} tone={status.tone}>
              {needsData ? (
                <b className="q">?</b>
              ) : (
                <>
                  <b>
                    <small>R$</small>{reais}<small>,{cents}</small>
                  </b>
                  <span>{showPossible ? 'por dia · possíveis' : 'por dia'}</span>
                </>
              )}
            </Ring>
          )}

          <div className="today-side">
            <span className={`pill ${status.tone}`}><StatusIcon />{status.label}</span>
            {current && !needsData && (
              <>
                <div className="kv"><span>Gasto hoje</span><b>{brl0(spentTodayVar)}</b></div>
                <div className="kv"><span>Resta hoje</span><b className={a.verdict === 'broke' ? 'bad' : ''}>{brl0(leftShown)}</b></div>
                {a.binding && <div className="kv dim"><span>Planejado até</span><b>{ddmm(a.binding.date)}</b></div>}
              </>
            )}
            {f.phase === 'future' && !needsData && (
              <div className="kv"><span>Livre no mês</span><b>{brl0(a.free)}</b></div>
            )}
            {a.verdict === 'no-balance' && (
              <button className="btn small-cta" onClick={onBalance}>Informar saldo</button>
            )}
            {a.verdict === 'no-income' && (
              <button className="btn small-cta" onClick={onNewPlanned}>Cadastrar receita</button>
            )}
          </div>

          {f.phase !== 'past' && !needsData && (
            <button className="info-btn" onClick={() => setShowCalc(true)} aria-label="Como calculamos"><IconInfo /></button>
          )}
        </div>

        <div className="tiles">
          {f.phase === 'past' ? (
            <>
              <div className="tile"><i className="in"><IconTrend /></i><span>Entrou</span><b>{brl0(f.received)}</b></div>
              <div className="tile"><i><IconDown /></i><span>Gastei</span><b>{brl0(f.spent)}</b></div>
              <div className="tile"><i><IconTarget /></i><span>Meta</span><b>{f.goal > 0 ? (f.endBalance >= f.goal ? 'Atingida' : 'Não') : '—'}</b></div>
            </>
          ) : f.phase === 'future' ? (
            <>
              <div className="tile"><i className="in"><IconTrend /></i><span>Entra</span><b>{brl0(f.willReceive)}</b></div>
              <div className="tile"><i><IconCalendar /></i><span>Contas</span><b>{brl0(f.billsOpen)}</b></div>
              <div className="tile"><i><IconTarget /></i><span>Guardar</span><b>{f.goal ? brl0(f.goal) : '—'}</b></div>
            </>
          ) : (
            <>
              <div className="tile"><i><IconDown /></i><span>Gasto</span><b>{brl0(f.spent)}</b></div>
              <div className="tile"><i><IconTrend /></i><span>Previsão</span><b>{brl0(f.willSpend)}</b></div>
              <div className="tile"><i className={endShown < 0 ? 'bad' : 'in'}><IconWallet /></i><span>Fim do mês</span><b className={endShown < 0 ? 'bad' : ''}>{signed0(endShown)}</b></div>
            </>
          )}
        </div>
      </section>

      {current && a.path && a.path.length > 1 && !needsData && (
        <section className="card chart-card">
          <div className="chart-head">
            <span className="t">Saldo na conta</span>
            <button className="balance-btn" onClick={onBalance}>{brl(a.cash)}</button>
          </div>
          {f.possible && (
            <div className="seg mini">
              <button className={!showPossible ? 'on' : ''} onClick={() => setShowPossible(false)}>Garantido</button>
              <button className={showPossible ? 'on' : ''} onClick={() => setShowPossible(true)}>Com possíveis</button>
            </div>
          )}
          <BalanceChart path={showPossible && f.possible ? f.possible.path : a.path} />
          {bindingLater && !showPossible && (
            <div className="chart-note"><IconCalendar />O limite diário guarda dinheiro para {bindingMonth.toLowerCase()}</div>
          )}
          {a.firstNegative && !showPossible && (
            <div className="chart-note bad"><IconAlert />No ritmo atual fica negativo em {ddmm(a.firstNegative.date)}</div>
          )}
          <button className="chart-more" onClick={() => goTo('insights', 'future')}>
            Próximos meses <IconNext />
          </button>
        </section>
      )}

      {f.phase !== 'past' && f.willReceive <= 0 && !needsData && (
        <button className="card plan-empty" onClick={onNewPlanned}>
          <span><b>Cadastrar receita mensal</b></span>
          <span className="chev"><IconNext /></span>
        </button>
      )}

      {current && !f.goal && !needsData && (
        <button className="card plan-empty goal-row" onClick={() => goTo('settings')}>
          <i className="goal-ico"><IconTarget /></i>
          <span><b>Definir meta de economia</b></span>
          <span className="chev"><IconNext /></span>
        </button>
      )}

      {showCalc && (
        <Sheet onClose={() => setShowCalc(false)}>
          <div className="sheet-h">
            <button className="icon-btn" onClick={() => setShowCalc(false)} aria-label="Fechar"><IconX /></button>
            <h3>Como calculamos</h3>
            <span style={{ width: 36 }} />
          </div>
          <p className="muted" style={{ fontSize: 13, lineHeight: 1.5, margin: '0 4px 8px' }}>
            O valor por dia é o máximo que você pode gastar sem a conta ficar negativa em nenhum vencimento dos próximos 6 meses.
            Receitas só contam a partir do dia em que caem; valores possíveis ficam de fora.
          </p>
          <div className="calc-table">
            {current && a.binding ? (
              <>
                <div><span>{hasBalance ? 'Saldo em conta' : 'Receitas menos despesas do mês'}</span><span>{signed(a.cash)}</span></div>
                <div><span>Receitas previstas até {ddmm(a.binding.date)}</span><span>+{brl(a.binding.inflow)}</span></div>
                <div><span>Contas previstas até {ddmm(a.binding.date)}</span><span>−{brl(a.binding.outflow)}</span></div>
                {a.binding.goals > 0 && <div><span>Metas de economia até {ddmm(a.binding.date)}</span><span>−{brl(a.binding.goals)}</span></div>}
                {todayBackLook > 0.005 && <div className="dim"><span>Gastos de hoje (já descontados do dia)</span><span>+{brl(todayBackLook)}</span></div>}
                <div className="total"><span>Disponível até {ddmm(a.binding.date)}</span><span>{signed(a.free)}</span></div>
                {a.free > 0 && <div className="total"><span>÷ {a.binding.days} dias</span><span>{brl(a.perDay)}/dia</span></div>}
              </>
            ) : (
              <>
                <div><span>Receitas previstas</span><span>{brl(f.willReceive)}</span></div>
                <div><span>Contas a pagar</span><span>−{brl(f.billsOpen)}</span></div>
                {f.goal > 0 && <div><span>Meta de economia</span><span>−{brl(f.goal)}</span></div>}
                {todayBack > 0 && <div className="dim"><span>Gastos de hoje</span><span>+{brl(todayBack)}</span></div>}
                <div className="total"><span>Disponível</span><span>{signed(a.free)}</span></div>
                {a.daysLeft > 0 && a.free > 0 && <div className="total"><span>÷ {a.daysLeft} dias</span><span>{brl(a.perDay)}/dia</span></div>}
              </>
            )}
            {current && (
              <div className="dim"><span>Média diária atual</span><span>{brl(a.pace)}</span></div>
            )}
            {current && a.incoming > 0 && (
              <div className="dim"><span>A receber até {lastDay}</span><span>+{brl(a.incoming)}</span></div>
            )}
            {f.possible && (
              <div className="dim">
                <span>Com os valores possíveis ({f.possible.inflow ? `+${brl0(f.possible.inflow)}` : ''}{f.possible.outflow ? ` −${brl0(f.possible.outflow)}` : ''})</span>
                <span>{brl(Math.max(0, f.possible.perDay ?? 0))}/dia</span>
              </div>
            )}
            {budget ? (
              <div className="dim"><span>Limite de gastos {brl0(budget)}</span><span>previsão {projPct.toFixed(0)}%</span></div>
            ) : null}
          </div>
        </Sheet>
      )}

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
