import { brl, monthKey, monthLabel } from '../lib/format'
import { occStatus, type Occurrence } from '../lib/planned'
import { summarize, useOccurrences } from '../lib/usePlanned'
import { OccurrenceRow } from './OccurrenceRow'

interface Props {
  month: string
  onOpen: (o: Occurrence) => void
  onPay: (o: Occurrence) => void
  onNew: () => void
}

export function PlannedList({ month, onOpen, onPay, onNew }: Props) {
  const occ = useOccurrences(month)
  const exp = summarize(occ, 'expense')
  const inc = summarize(occ, 'income')

  const groups: Array<{ title: string; items: Occurrence[]; tone?: string }> = [
    { title: 'Atrasadas', items: occ.filter((o) => occStatus(o) === 'overdue'), tone: 'var(--red)' },
    { title: 'A vencer', items: occ.filter((o) => ['today', 'upcoming'].includes(occStatus(o))) },
    { title: 'Pagas e recebidas', items: occ.filter((o) => occStatus(o) === 'paid') },
    { title: 'Puladas', items: occ.filter((o) => occStatus(o) === 'skipped') },
  ].filter((g) => g.items.length)

  return (
    <>
      <div className="strip">
        <div className="stat">
          <div className="k">Previsto</div>
          <div className="v">{brl(exp.total)}</div>
        </div>
        <div className="stat">
          <div className="k">Pago</div>
          <div className="v" style={{ color: 'var(--green)' }}>{brl(exp.paid)}</div>
        </div>
        <div className="stat">
          <div className="k">Falta</div>
          <div className="v" style={{ color: exp.open ? '#ffb3b3' : undefined }}>{brl(exp.open)}</div>
        </div>
      </div>
      {inc.total > 0 && (
        <p className="muted" style={{ fontSize: 13, margin: '8px 4px 0' }}>
          A receber: {brl(inc.open)} de {brl(inc.total)} previstos
        </p>
      )}

      <button className="btn ghost add-planned" onClick={onNew}>+ Nova conta prevista</button>

      {groups.map((g) => (
        <div key={g.title}>
          <div className="day-h">
            <span style={{ color: g.tone }}>{g.title}</span>
            <span>{g.items.length}</span>
          </div>
          <div className="tx-group">
            {g.items.map((o) => (
              <OccurrenceRow key={`${o.planned.id}-${o.month}`} o={o} onOpen={onOpen} onPay={onPay} />
            ))}
          </div>
        </div>
      ))}

      {!occ.length && (
        <div className="card empty" style={{ marginTop: 12 }}>
          <span className="e">🗓️</span>
          Nenhuma conta prevista em {monthLabel(month).toLowerCase()}.
          <br />
          {month >= monthKey(new Date()) && 'Cadastre aluguel, internet, assinaturas e parcelas para ver quanto ainda vai sair.'}
        </div>
      )}
    </>
  )
}
