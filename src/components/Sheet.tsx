import { useEffect, useRef, type ReactNode } from 'react'

// Painel inferior estilo iOS; arrastar o topo para baixo fecha.
export function Sheet({ onClose, children, full }: { onClose: () => void; children: ReactNode; full?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const start = useRef<number | null>(null)

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  const onTouchStart = (e: React.TouchEvent) => {
    if ((ref.current?.scrollTop ?? 0) > 0) return
    start.current = e.touches[0].clientY
  }
  const onTouchMove = (e: React.TouchEvent) => {
    if (start.current == null || !ref.current) return
    const dy = e.touches[0].clientY - start.current
    if (dy > 0) ref.current.style.transform = `translateY(${dy}px)`
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    if (start.current == null || !ref.current) return
    const dy = e.changedTouches[0].clientY - start.current
    start.current = null
    if (dy > 110) onClose()
    else {
      ref.current.style.transition = 'transform 0.2s ease'
      ref.current.style.transform = ''
      setTimeout(() => ref.current && (ref.current.style.transition = ''), 200)
    }
  }

  return (
    <>
      <div className="backdrop" onClick={onClose} />
      <div ref={ref} className={`sheet${full ? ' full' : ''}`} role="dialog" aria-modal="true">
        <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} style={{ paddingBottom: 4 }}>
          <div className="grabber" />
        </div>
        {children}
      </div>
    </>
  )
}
