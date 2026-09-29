import { useStore } from '../lib/store'
import { brl, haptic } from '../lib/format'
import { occStatus, type Occurrence } from '../lib/planned'

export function statusText(o: Occurrence, today = new Date()) {
  const st = occStatus(o, today)
  const day = o.due.getDate()
  const days = Math.round((o.due.getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86400000)
  if (st === 'paid') return { st, text: o.planned.kind === 'income' ? 'Recebido' : 'Pago' }
  if (st === 'skipped') return { st, text: 'Pulado' }
  if (o.planned.kind === 'income') {
    if (st === 'today') return { st, text: 'Cai hoje' }
    if (st === 'overdue') return { st, text: days === -1 ? 'Era para ontem' : `Atrasado ${-days} dias` }
    return { st, text: days === 1 ? 'Cai amanhã' : days <= 7 ? `Cai em ${days} dias` : `Cai dia ${day}` }
  }
  if (st === 'today') return { st, text: 'Vence hoje' }
  if (st === 'overdue') return { st, text: days === -1 ? 'Venceu ontem' : `Venceu há ${-days} dias` }
  return { st, text: days === 1 ? 'Vence amanhã' : days <= 7 ? `Vence em ${days} dias` : `Vence dia ${day}` }
}

interface Props {
  o: Occurrence
  onOpen: (o: Occurrence) => void
  onPay: (o: Occurrence) => void
}

export function OccurrenceRow({ o, onOpen, onPay }: Props) {
  const { catById } = useStore()
  const c = o.planned.category_id ? catById.get(o.planned.category_id) : undefined
  const { st, text } = statusText(o)
  const done = st === 'paid' || st === 'skipped'

  return (
    <div className={`tx occ ${st}`} onClick={() => onOpen(o)} role="button">
      <span className="ico" style={{ background: `color-mix(in srgb, ${c?.color ?? '#8b8b9e'} 22%, transparent)` }}>{c?.emoji ?? '🧾'}</span>
      <span className="mid">
        <div className="title">{o.label}</div>
        <div className="meta">
          {o.planned.tentative && !o.paid && <span className="badge maybe">POSSÍVEL</span>}
          <span className={`st ${st}`}>{text}</span>
          {c && <span>· {c.name}</span>}
        </div>
      </span>
      <span className={`amt${o.planned.kind === 'income' ? ' in' : ''}${done ? ' done' : ''}`}>
        {brl(o.paid ? o.paid.amount : o.amount)}
      </span>
      <button
        className={`check${st === 'paid' ? ' on' : ''}`}
        aria-label={st === 'paid' ? 'Pago' : 'Marcar como pago'}
        disabled={st === 'skipped'}
        onClick={(e) => {
          e.stopPropagation()
          if (st === 'paid') return onOpen(o)
          haptic(20)
          onPay(o)
        }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5 10 17 19 7" /></svg>
      </button>
    </div>
  )
}
