// Anel de progresso do dia: quanto do limite de hoje já foi gasto
export function Ring({ value, max, tone, children }: { value: number; max: number; tone: string; children: React.ReactNode }) {
  const r = 52
  const C = 2 * Math.PI * r
  const pct = max > 0 ? Math.min(1, value / max) : value > 0 ? 1 : 0
  return (
    <div className="ring">
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="9" />
        <circle
          className={`ring-fill ${tone}`}
          cx="60"
          cy="60"
          r={r}
          fill="none"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${Math.max(0.001, pct * C)} ${C}`}
          transform="rotate(-90 60 60)"
        />
      </svg>
      <div className="ring-center">{children}</div>
    </div>
  )
}
