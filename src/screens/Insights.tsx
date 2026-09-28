import { useMemo, useState } from 'react'
import { useStore } from '../lib/store'
import { MonthSwitch } from '../components/MonthSwitch'
import { brl, brl0, daysInMonth, MONTHS, monthKey, monthLabel, shiftMonth } from '../lib/format'
import { byCategory, dailyExpense, monthTxs, totals, type CatTotal } from '../lib/stats'
import { summarize, useOccurrences } from '../lib/usePlanned'

const MAX_SLICES = 7

function Donut({ data, total }: { data: CatTotal[]; total: number }) {
  const [sel, setSel] = useState<string | null>(null)
  const r = 42
  const C = 2 * Math.PI * r
  const gap = data.length > 1 ? 1.2 : 0 // 2px de superfície entre fatias
  let offset = 0
  const active = data.find((d) => d.id === sel)

  return (
    <div className="donut-wrap">
      <div className="donut">
        <svg viewBox="0 0 100 100" role="img" aria-label="Gastos por categoria">
          <circle cx="50" cy="50" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="14" />
          {data.map((d) => {
            const len = (d.total / total) * C
            const el = (
              <circle
                key={d.id}
                className="seg"
                cx="50"
                cy="50"
                r={r}
                fill="none"
                stroke={d.color}
                strokeWidth={sel === d.id ? 16 : 14}
                strokeDasharray={`${Math.max(0.5, len - gap)} ${C}`}
                strokeDashoffset={-offset}
                opacity={sel && sel !== d.id ? 0.35 : 1}
                onClick={() => setSel(sel === d.id ? null : d.id)}
              >
                <title>{`${d.name}: ${brl(d.total)}`}</title>
              </circle>
            )
            offset += len
            return el
          })}
        </svg>
        <div className="center">
          <div>
            <div className="k">{active ? `${active.emoji} ${active.name}` : 'Total'}</div>
            <div className="v">{brl0(active ? active.total : total)}</div>
            {active && <div className="k">{((active.total / total) * 100).toFixed(1)}%</div>}
          </div>
        </div>
      </div>
      <div className="legend">
        {data.map((d) => (
          <button key={d.id} onClick={() => setSel(sel === d.id ? null : d.id)} style={{ opacity: sel && sel !== d.id ? 0.5 : 1 }}>
            <i style={{ background: d.color }} />
            <span className="n">{d.name}</span>
            <span className="p">{((d.total / total) * 100).toFixed(0)}%</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export function Insights({ month, setMonth }: { month: string; setMonth: (m: string) => void }) {
  const { txs, catById } = useStore()
  const [selDay, setSelDay] = useState<number | null>(null)
  const [selMonth, setSelMonth] = useState<string | null>(null)

  const mTxs = useMemo(() => monthTxs(txs, month), [txs, month])
  const occ = useOccurrences(month)
  const t = totals(mTxs)
  const prev = totals(monthTxs(txs, shiftMonth(month, -1)))

  const slices = useMemo(() => {
    // Categorias em cinza neutro ("Outros", sem categoria) e o excedente viram uma fatia só, no fim
    const all = byCategory(mTxs, catById)
    const isNeutral = (c: CatTotal) => c.color.toLowerCase() === '#8b8b9e'
    const colored = all.filter((c) => !isNeutral(c))
    const keep = colored.slice(0, MAX_SLICES - 1)
    const rest = [...colored.slice(MAX_SLICES - 1), ...all.filter(isNeutral)]
    if (!rest.length) return keep
    if (rest.length === 1) return [...keep, rest[0]]
    return [
      ...keep,
      { id: 'rest', name: 'Outros', emoji: '💸', color: '#8b8b9e', total: rest.reduce((s, c) => s + c.total, 0), count: rest.reduce((s, c) => s + c.count, 0) },
    ]
  }, [mTxs, catById])

  const days = daysInMonth(month)
  const daily = useMemo(() => dailyExpense(mTxs, month, days), [mTxs, month, days])
  const isCurrent = month === monthKey(new Date())
  const todayIdx = isCurrent ? new Date().getDate() - 1 : -1
  const elapsed = isCurrent ? new Date().getDate() : days
  const avg = t.expense / Math.max(1, elapsed)
  const maxDay = Math.max(...daily, avg, 1)
  // Projeção = já gasto + contas previstas em aberto + ritmo dos gastos do dia a dia (sem as contas) nos dias que faltam
  const planExp = summarize(occ, 'expense')
  const variableAvg = (t.expense - planExp.paid) / Math.max(1, elapsed)
  const projection = isCurrent ? t.expense + planExp.open + variableAvg * (days - elapsed) : null

  const history = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => {
        const key = shiftMonth(month, i - 5)
        return { key, ...totals(monthTxs(txs, key)) }
      }),
    [txs, month],
  )
  const maxHist = Math.max(...history.map((h) => Math.max(h.expense, h.income)), 1)
  const selHist = history.find((h) => h.key === selMonth)

  const delta = prev.expense ? ((t.expense - prev.expense) / prev.expense) * 100 : null
  const topDay = daily.reduce((best, v, i) => (v > daily[best] ? i : best), 0)

  return (
    <div className="screen">
      <div className="topbar">
        <h1>Análise</h1>
        <MonthSwitch month={month} setMonth={setMonth} />
      </div>

      <div className="strip" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="stat">
          <div className="k">vs mês anterior</div>
          <div className={`v ${delta == null ? '' : delta > 0 ? 'up' : 'down'}`}>
            {delta == null ? '—' : `${delta > 0 ? '▲' : '▼'} ${Math.abs(delta).toFixed(0)}%`}
          </div>
        </div>
        <div className="stat">
          <div className="k">{projection ? 'Projeção do mês' : 'Maior dia'}</div>
          <div className="v">{projection ? brl0(projection) : daily[topDay] ? `${topDay + 1}/${month.slice(5)} · ${brl0(daily[topDay])}` : '—'}</div>
        </div>
      </div>

      <div className="section-h"><h2>Por categoria</h2></div>
      <div className="card">
        {slices.length ? <Donut data={slices} total={t.expense} /> : <div className="empty">Sem gastos neste mês.</div>}
      </div>

      <div className="section-h"><h2>Gasto por dia</h2></div>
      <div className="card">
        <div className="tip">
          {selDay != null ? (
            <>Dia <b>{selDay + 1}</b>: <b>{brl(daily[selDay])}</b></>
          ) : (
            <>┈ Média de <b>{brl(avg)}</b> por dia · toque numa barra</>
          )}
        </div>
        <div className="bars" onMouseLeave={() => setSelDay(null)}>
          <div className="avg" style={{ bottom: `${(avg / maxDay) * (150 - 18)}px` }} />
          {daily.map((v, i) => (
            <div
              key={i}
              className={`col${i === todayIdx ? ' today' : ''}${v === 0 ? ' zero' : ''}${selDay === i ? ' sel' : ''}`}
              onClick={() => setSelDay(selDay === i ? null : i)}
              onMouseEnter={() => setSelDay(i)}
            >
              <i style={{ height: `${(v / maxDay) * 100}%` }} />
            </div>
          ))}
        </div>
        <div className="axis">
          <span>1</span>
          <span>{Math.ceil(days / 2)}</span>
          <span>{days}</span>
        </div>
      </div>

      <div className="section-h"><h2>Últimos 6 meses</h2></div>
      <div className="card">
        <div className="key-legend">
          <span><i style={{ background: '#ff8a8a' }} />Gastos</span>
          <span><i style={{ background: 'var(--green)' }} />Receitas</span>
        </div>
        <div className="tip">
          {selHist ? (
            <>
              {monthLabel(selHist.key, true)}: <b>{brl(selHist.expense)}</b> gastos · <b>{brl(selHist.income)}</b> receitas
            </>
          ) : (
            <>Toque em um mês para ver os valores</>
          )}
        </div>
        <div className="months">
          {history.map((h) => (
            <div
              key={h.key}
              className={`m${h.key === month ? ' on' : ''}`}
              onClick={() => setSelMonth(selMonth === h.key ? null : h.key)}
              onMouseEnter={() => setSelMonth(h.key)}
              onMouseLeave={() => setSelMonth(null)}
            >
              <div className="pair">
                <i style={{ height: `${(h.expense / maxHist) * 100}%`, background: '#ff8a8a' }} />
                <i style={{ height: `${(h.income / maxHist) * 100}%`, background: 'var(--green)' }} />
              </div>
              <span className="lbl">{MONTHS[Number(h.key.slice(5)) - 1].slice(0, 3)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
