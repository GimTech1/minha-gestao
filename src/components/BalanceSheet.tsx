import { useState } from 'react'
import { Sheet } from './Sheet'
import { IconX } from './icons'
import { useStore } from '../lib/store'
import { useAccountBalance } from '../lib/usePlanned'
import { brl } from '../lib/format'

// "Quanto você tem na conta agora?": ponto de partida do saldo real; depois o app acompanha pelos lançamentos
export function BalanceSheet({ onClose, notify }: { onClose: () => void; notify: (m: string) => void }) {
  const { updateProfile } = useStore()
  const current = useAccountBalance()
  const [value, setValue] = useState(current != null ? current.toFixed(2).replace('.', ',') : '')
  const [busy, setBusy] = useState(false)

  const raw = value.trim()
  const negative = raw.startsWith('-') || raw.startsWith('−')
  const digits = raw.replace(/[^\d,.]/g, '')
  const parsed = digits ? Number(digits.replace(/\./g, '').replace(',', '.')) * (negative ? -1 : 1) : NaN
  const valid = Number.isFinite(parsed)

  const save = async () => {
    if (!valid) return
    setBusy(true)
    try {
      await updateProfile({ balance_amount: Math.round(parsed * 100) / 100, balance_at: new Date().toISOString() })
      notify('Saldo atualizado')
      onClose()
    } catch (e) {
      notify(`Erro: ${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet onClose={onClose}>
      <div className="sheet-h">
        <button className="icon-btn" onClick={onClose} aria-label="Fechar"><IconX /></button>
        <h3>Saldo em conta</h3>
        <button className="text-btn" onClick={save} disabled={!valid || busy}>Salvar</button>
      </div>
      <p className="muted" style={{ fontSize: 14, lineHeight: 1.5, margin: '0 4px 14px' }}>
        Quanto você tem na conta <b style={{ color: 'var(--text)' }}>agora</b>? Olhe no app do banco. Daqui para frente eu somo o que entra e
        subtraio o que sai, e o "quanto posso gastar" usa só esse dinheiro. O salário a receber entra no limite quando cair.
      </p>
      <label className="field">
        <span>Saldo agora (R$) · use − se estiver no negativo</span>
        <input className="input big-input" inputMode="text" value={value} onChange={(e) => setValue(e.target.value)} placeholder="0,00" autoFocus />
      </label>
      {current != null && (
        <p className="muted" style={{ fontSize: 12, margin: '-4px 4px 12px' }}>Pelos lançamentos, hoje daria {brl(current)}.</p>
      )}
      <div className="pill-tip" style={{ marginBottom: 12 }}>
        Se o salário já caiu, informe o saldo <b>depois</b> de marcá-lo como recebido, para não contar duas vezes.
      </div>
      <button className="btn" style={{ width: '100%' }} onClick={save} disabled={!valid || busy}>Salvar saldo</button>
    </Sheet>
  )
}
