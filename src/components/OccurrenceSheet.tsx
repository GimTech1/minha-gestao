import { useState } from 'react'
import { Sheet } from './Sheet'
import { IconX } from './icons'
import { useStore } from '../lib/store'
import { parseMoney } from '../lib/parser'
import { brl, haptic, monthLabel } from '../lib/format'
import { describePlan, monthStart, type Occurrence } from '../lib/planned'
import { paymentTx } from '../lib/usePlanned'
import { statusText } from './OccurrenceRow'

interface Props {
  o: Occurrence
  onClose: () => void
  onEdit: () => void
  notify: (msg: string, undo?: () => void) => void
}

export function OccurrenceSheet({ o, onClose, onEdit, notify }: Props) {
  const { catById, txs, saveTx, deleteTx, savePlanned } = useStore()
  const [amount, setAmount] = useState(o.amount.toFixed(2).replace('.', ','))
  const c = o.planned.category_id ? catById.get(o.planned.category_id) : undefined
  const { st, text } = statusText(o)
  const paidTx = o.paid ? txs.find((t) => t.id === o.paid!.id) : undefined
  const isIncome = o.planned.kind === 'income'
  const value = parseMoney(amount) ?? 0

  const pay = () => {
    if (!value) return
    const tx = paymentTx(o, value)
    saveTx(tx)
    haptic(20)
    notify(`✓ ${o.label} ${isIncome ? 'recebido' : 'pago'}`, () => deleteTx(tx.id))
    onClose()
  }

  const unpay = () => {
    if (!paidTx) return
    deleteTx(paidTx.id)
    notify('Pagamento desfeito', () => saveTx(paidTx))
    onClose()
  }

  const toggleSkip = async () => {
    const key = monthStart(o.month)
    const skipped = o.skipped
      ? o.planned.skipped_months.filter((m) => m.slice(0, 7) !== o.month)
      : [...o.planned.skipped_months, key]
    await savePlanned({ ...o.planned, skipped_months: skipped })
    notify(o.skipped ? 'Voltou para o previsto' : `Pulado em ${monthLabel(o.month).toLowerCase()}`)
    onClose()
  }

  return (
    <Sheet onClose={onClose}>
      <div className="sheet-h">
        <button className="icon-btn" onClick={onClose} aria-label="Fechar"><IconX /></button>
        <h3>{isIncome ? 'Conta a receber' : 'Conta a pagar'}</h3>
        <button className="text-btn" onClick={onEdit}>Editar</button>
      </div>

      <div className="occ-head">
        <span className="ico" style={{ background: `color-mix(in srgb, ${c?.color ?? '#8b8b9e'} 22%, transparent)` }}>{c?.emoji ?? '🧾'}</span>
        <div className="t">{o.label}</div>
        <div className="s">
          <span className={`st ${st}`}>{text}</span> · {o.due.toLocaleDateString('pt-BR')} · {describePlan(o.planned)}
        </div>
      </div>

      {st === 'paid' ? (
        <>
          <div className="card" style={{ background: 'var(--surface-2)', textAlign: 'center', marginBottom: 12 }}>
            <div className="muted" style={{ fontSize: 13 }}>{isIncome ? 'Recebido' : 'Pago'} em {paidTx ? new Date(paidTx.occurred_at).toLocaleDateString('pt-BR') : '—'}</div>
            <div style={{ fontSize: 28, fontWeight: 800, marginTop: 4 }}>{brl(o.paid!.amount)}</div>
          </div>
          <button className="btn ghost" style={{ width: '100%' }} onClick={unpay}>Desfazer pagamento</button>
        </>
      ) : st === 'skipped' ? (
        <button className="btn ghost" style={{ width: '100%' }} onClick={toggleSkip}>Desfazer pulo deste mês</button>
      ) : (
        <>
          <label className="field">
            <span>Valor {isIncome ? 'recebido' : 'pago'} (se mudou, ajuste aqui)</span>
            <input className="input big-input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>
          <button className={`btn${isIncome ? ' inc' : ''}`} style={{ width: '100%' }} onClick={pay} disabled={!value}>
            {isIncome ? 'Marcar como recebido' : 'Marcar como pago'}
          </button>
          <button className="btn ghost" style={{ width: '100%', marginTop: 8 }} onClick={toggleSkip}>
            Pular só este mês
          </button>
        </>
      )}
    </Sheet>
  )
}
