import { IconBack, IconNext } from './icons'
import { monthKey, monthLabel, shiftMonth } from '../lib/format'

export function MonthSwitch({ month, setMonth }: { month: string; setMonth: (m: string) => void }) {
  const isCurrent = month === monthKey(new Date())
  return (
    <div className="month-switch">
      <button onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Mês anterior"><IconBack /></button>
      <span onClick={() => setMonth(monthKey(new Date()))}>{monthLabel(month)}</span>
      <button onClick={() => setMonth(shiftMonth(month, 1))} disabled={isCurrent} aria-label="Próximo mês"><IconNext /></button>
    </div>
  )
}
