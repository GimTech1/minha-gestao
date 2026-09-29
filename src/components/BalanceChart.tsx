import { useMemo, useState } from 'react'
import { brl, brl0, cap } from '../lib/format'

interface Point {
  date: Date
  balance: number
}

// Linha do saldo previsto em conta: ponto mais apertado marcado, trecho abaixo de zero em vermelho
export function BalanceChart({ path }: { path: Point[] }) {
  const [sel, setSel] = useState<number | null>(null)
  const W = 320
  const H = 128
  const padT = 14
  const padB = 20

  const geo = useMemo(() => {
    const t0 = path[0].date.getTime()
    const t1 = Math.max(t0 + 86400000, path[path.length - 1].date.getTime())
    const vals = path.map((p) => p.balance)
    const lo = Math.min(0, ...vals)
    const hi = Math.max(1, ...vals)
    const x = (d: Date) => ((d.getTime() - t0) / (t1 - t0)) * W
    const y = (v: number) => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB)
    const pts = path.map((p) => ({ ...p, x: x(p.date), y: y(p.balance) }))
    const minIdx = vals.reduce((m, v, i) => (v < vals[m] ? i : m), 0)
    const zeroY = y(0)
    // Rótulos de mês no eixo
    const ticks: Array<{ x: number; label: string }> = []
    const start = new Date(path[0].date.getFullYear(), path[0].date.getMonth() + 1, 1)
    for (let d = start; d.getTime() <= t1; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
      ticks.push({ x: x(d), label: cap(d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')) })
    }
    return { pts, minIdx, zeroY, ticks, lo }
  }, [path])

  const line = geo.pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const area = `${line} L${W},${H - padB} L0,${H - padB} Z`
  const zeroPct = Math.min(100, Math.max(0, (geo.zeroY / H) * 100))
  const active = sel != null ? geo.pts[sel] : geo.pts[geo.minIdx]
  const fmt = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

  const pick = (clientX: number, el: SVGSVGElement) => {
    const r = el.getBoundingClientRect()
    const px = ((clientX - r.left) / r.width) * W
    let best = 0
    geo.pts.forEach((p, i) => {
      if (Math.abs(p.x - px) < Math.abs(geo.pts[best].x - px)) best = i
    })
    setSel(best)
  }

  return (
    <div className="bchart">
      <div className="bchart-tip">
        <span>{sel == null ? 'Ponto mais baixo' : sel === 0 ? 'Hoje' : fmt(active.date)}</span>
        <b className={active.balance < 0 ? 'bad' : ''}>{brl(active.balance)}</b>
        {sel == null && <span className="dim">em {fmt(active.date)}</span>}
      </div>
      <div className="bchart-plot">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        onPointerMove={(e) => pick(e.clientX, e.currentTarget)}
        onPointerDown={(e) => pick(e.clientX, e.currentTarget)}
        onPointerLeave={() => setSel(null)}
        role="img"
        aria-label="Saldo previsto em conta"
      >
        <defs>
          <linearGradient id="bc-stroke" x1="0" y1="0" x2="0" y2={H} gradientUnits="userSpaceOnUse">
            <stop offset={`${zeroPct}%`} stopColor="var(--accent)" />
            <stop offset={`${zeroPct}%`} stopColor="var(--red)" />
          </linearGradient>
          <linearGradient id="bc-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#bc-fill)" />
        {geo.lo < 0 && <line x1="0" x2={W} y1={geo.zeroY} y2={geo.zeroY} className="bc-zero" />}
        <path d={line} fill="none" stroke="url(#bc-stroke)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        {geo.ticks.map((t) => (
          <line key={t.x} x1={t.x} x2={t.x} y1={H - padB} y2={H - padB + 3} className="bc-tick" />
        ))}
      </svg>
      <div className="bchart-dot" style={{ left: `${(active.x / W) * 100}%`, top: `${(active.y / H) * 100}%` }} data-bad={active.balance < 0} />
      </div>
      <div className="bchart-axis">
        {geo.ticks.map((t) => (
          <span key={t.x} style={{ left: `${(t.x / W) * 100}%` }}>{t.label}</span>
        ))}
      </div>
      <span className="sr-only">Saldo mínimo previsto {brl0(geo.pts[geo.minIdx].balance)}</span>
    </div>
  )
}
