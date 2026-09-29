import { useMemo, useState } from 'react'
import { useStore } from '../lib/store'
import { brl, brl0, cap, MONTHS, monthKey } from '../lib/format'
import { paidIndex } from '../lib/planned'
import { useForecast } from '../lib/usePlanned'
import { estimateVariablePerMonth, projectMonths } from '../lib/projection'

const signed = (n: number) => `${n < 0 ? '−' : '+'}${brl(Math.abs(n))}`
const signed0 = (n: number) => `${n < 0 ? '−' : '+'}${brl0(Math.abs(n))}`
const monthShort = (m: string) => cap(MONTHS[Number(m.slice(5)) - 1].slice(0, 3))
const monthLong = (m: string) => `${cap(MONTHS[Number(m.slice(5)) - 1])} ${m.slice(0, 4)}`

export function FutureView({ onOpenMonth }: { onOpenMonth: (m: string) => void }) {
  const { planned, txs, catById } = useStore()
  const current = monthKey(new Date())
  const f = useForecast(current)
  const [horizon, setHorizon] = useState(12)
  const [includeVariable, setIncludeVariable] = useState(true)
  const [sel, setSel] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const hasBalance = f.accountBalance != null

  const variablePerMonth = useMemo(
    () => estimateVariablePerMonth(txs, current, f.allowance.pace),
    [txs, current, f.allowance.pace],
  )

  const rows = useMemo(
    () =>
      projectMonths({
        planned,
        paid: paidIndex(txs),
        // Com saldo informado, o mês atual conta só o que ainda falta entrar e sair
        current: hasBalance
          ? { month: current, willReceive: f.allowance.incoming, bills: f.billsOpen, variable: f.variableAhead }
          : { month: current, willReceive: f.willReceive, bills: f.spent + f.billsOpen, variable: f.variableAhead },
        variablePerMonth,
        horizon,
        includeVariable,
        start: hasBalance ? f.allowance.cash - f.allowance.reserved : 0,
      }),
    [planned, txs, current, f, variablePerMonth, horizon, includeVariable, hasBalance],
  )

  const last = rows[rows.length - 1]
  const avg = (last.cumulative - (hasBalance ? f.allowance.cash - f.allowance.reserved : 0)) / rows.length
  const worst = rows.reduce((w, r) => (r.balance < w.balance ? r : w), rows[0])
  const firstNegative = rows.find((r) => r.cumulative < 0)
  const maxAbs = Math.max(1, ...rows.map((r) => Math.abs(r.cumulative)))
  const hasNeg = rows.some((r) => r.cumulative < 0)
  const hasPos = rows.some((r) => r.cumulative > 0)
  // Área acima e abaixo do zero proporcional aos valores
  const posMax = Math.max(0, ...rows.map((r) => r.cumulative))
  const negMax = Math.max(0, ...rows.map((r) => -r.cumulative))
  const zeroPct = hasNeg && hasPos ? (posMax / (posMax + negMax)) * 100 : hasNeg ? 0 : 100
  const selRow = rows.find((r) => r.month === sel)
  const noIncome = rows.every((r) => r.income === 0)

  return (
    <>
      <div className="chips" style={{ marginTop: 0 }}>
        {[6, 12].map((h) => (
          <button key={h} className={`chip${horizon === h ? ' on' : ''}`} onClick={() => setHorizon(h)}>{h} meses</button>
        ))}
        <button className={`chip${includeVariable ? ' on' : ''}`} onClick={() => setIncludeVariable(!includeVariable)}>
          {includeVariable ? '✓ ' : ''}Dia a dia ~{brl0(variablePerMonth)}/mês
        </button>
      </div>

      <div className={`card future-hero ${last.cumulative < 0 ? 'neg' : 'pos'}`}>
        <div className="k">{hasBalance ? `Na conta no fim de ${monthLong(last.month).toLowerCase()}` : `Até ${monthLong(last.month).toLowerCase()} você acumula`}</div>
        <div className="v">{signed(last.cumulative)}</div>
        <div className="s">
          {hasBalance ? `hoje: ${signed0(f.allowance.cash)} · ` : ''}média de {signed0(avg)} por mês
          {noIncome && ' · cadastre seu salário em Previstos para a conta ficar certa'}
        </div>
        {firstNegative ? (
          <div className="warn">⚠️ Em {monthLong(firstNegative.month).toLowerCase()} o acumulado fica negativo ({signed0(firstNegative.cumulative)}).</div>
        ) : worst.balance < 0 ? (
          <div className="warn">⚠️ {monthLong(worst.month)} fecha no negativo ({signed0(worst.balance)}), mas o acumulado cobre.</div>
        ) : null}
      </div>

      <div className="section-h"><h2>{hasBalance ? 'Saldo em conta no fim de cada mês' : 'Acumulado'}</h2></div>
      <div className="card">
        <div className="tip">
          {selRow ? (
            <>
              <b>{monthLong(selRow.month)}</b>: {hasBalance ? 'na conta' : 'acumulado'} <b>{signed(selRow.cumulative)}</b> · no mês {signed0(selRow.balance)}
            </>
          ) : (
            <>Toque num mês para ver o acumulado até ele</>
          )}
        </div>
        <div className="cum-chart" onMouseLeave={() => setSel(null)}>
          <div className="zero" style={{ top: `${zeroPct}%` }} />
          {rows.map((r) => {
            const h = (Math.abs(r.cumulative) / maxAbs) * (r.cumulative >= 0 ? zeroPct : 100 - zeroPct)
            return (
              <div
                key={r.month}
                className={`cum-col${sel === r.month ? ' sel' : ''}`}
                onClick={() => setSel(sel === r.month ? null : r.month)}
                onMouseEnter={() => setSel(r.month)}
              >
                <i
                  className={r.cumulative < 0 ? 'neg' : ''}
                  style={r.cumulative >= 0 ? { bottom: `${100 - zeroPct}%`, height: `${h}%` } : { top: `${zeroPct}%`, height: `${h}%` }}
                />
              </div>
            )
          })}
        </div>
        <div className="cum-axis">
          {rows.map((r, idx) => (
            <span key={r.month}>{horizon === 12 && idx % 2 ? '' : monthShort(r.month)}</span>
          ))}
        </div>
      </div>

      <div className="section-h"><h2>Mês a mês</h2></div>
      <div className="list future-list">
        {rows.map((r) => {
          const bills = r.occ.filter((o) => o.planned.kind === 'expense')
          const incomes = r.occ.filter((o) => o.planned.kind === 'income')
          const isOpen = open === r.month
          return (
            <div key={r.month} className="fm">
              <button className="fm-row" onClick={() => setOpen(isOpen ? null : r.month)}>
                <div className="fm-m">
                  <b>{monthShort(r.month)}</b>
                  <span>{r.month.slice(0, 4)}</span>
                </div>
                <div className="fm-mid">
                  <span className="in">+{brl0(r.income)}</span>
                  <span className="out">−{brl0(r.bills + r.variable)}</span>
                </div>
                <div className="fm-right">
                  <div className={r.balance < 0 ? 'neg' : 'pos'}>{signed0(r.balance)}</div>
                  <div className="acc">{hasBalance ? 'conta' : 'acum.'} {signed0(r.cumulative)}</div>
                </div>
              </button>
              {isOpen && (
                <div className="fm-detail">
                  {r.month === current && (
                    <div className="line dim"><span>{hasBalance ? 'Parte do saldo em conta de hoje + o que falta entrar e sair' : 'Este mês usa o que já entrou e saiu + o que falta'}</span></div>
                  )}
                  {r.month !== current &&
                    incomes.map((o) => (
                      <div key={o.planned.id} className="line"><span>💰 {o.label}</span><span className="in">+{brl(o.amount)}</span></div>
                    ))}
                  {r.month === current && (
                    <>
                      <div className="line"><span>{hasBalance ? 'A receber' : 'Entradas (recebido + a receber)'}</span><span className="in">+{brl(r.income)}</span></div>
                      <div className="line"><span>{hasBalance ? 'Contas em aberto' : 'Já gastei + contas em aberto'}</span><span>−{brl(r.bills)}</span></div>
                    </>
                  )}
                  {r.month !== current &&
                    bills.map((o) => {
                      const c = o.planned.category_id ? catById.get(o.planned.category_id) : undefined
                      return (
                        <div key={o.planned.id} className="line">
                          <span>{c?.emoji ?? '🧾'} {o.label} <small>dia {o.due.getDate()}</small></span>
                          <span>−{brl(o.amount)}</span>
                        </div>
                      )
                    })}
                  {r.variable > 0 && (
                    <div className="line dim">
                      <span>🛒 Dia a dia {r.month === current ? '(resto do mês, no seu ritmo)' : '(estimado pela sua média)'}</span>
                      <span>−{brl(r.variable)}</span>
                    </div>
                  )}
                  {r.month !== current && !bills.length && !incomes.length && (
                    <div className="line dim"><span>Nenhuma conta prevista neste mês</span></div>
                  )}
                  <div className="line total"><span>Saldo do mês</span><span className={r.balance < 0 ? 'neg' : 'pos'}>{signed(r.balance)}</span></div>
                  <button className="text-btn" onClick={() => onOpenMonth(r.month)}>Ver contas de {monthShort(r.month).toLowerCase()} em Previstos →</button>
                </div>
              )}
            </div>
          )
        })}
      </div>
      <p className="muted" style={{ fontSize: 12, margin: '12px 4px 0', lineHeight: 1.5 }}>
        Contas e receitas vêm do que você cadastrou em Previstos. O dia a dia é estimado pela média dos seus gastos fora das contas
        {variablePerMonth ? ` (~${brl0(variablePerMonth)}/mês)` : ''}. A meta de guardar não é descontada aqui: o acumulado é o que sobra.{hasBalance ? ' Parte do saldo em conta que você informou.' : ' Informe seu saldo em conta no Início para ver quanto vai ter na conta.'}
      </p>
    </>
  )
}
