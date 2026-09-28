import { useCallback, useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { StoreProvider, useStore, type Tx } from './lib/store'
import { Login } from './screens/Login'
import { Home } from './screens/Home'
import { History } from './screens/History'
import { Insights } from './screens/Insights'
import { Settings } from './screens/Settings'
import { AddSheet } from './components/AddSheet'
import { IconChart, IconGear, IconHome, IconList, IconPlus } from './components/icons'
import { brl, monthKey } from './lib/format'

type Tab = 'home' | 'list' | 'insights' | 'settings'

function Shell() {
  const { saveTx, ready } = useStore()
  const [tab, setTab] = useState<Tab>('home')
  const [month, setMonth] = useState(monthKey(new Date()))
  // ?add=1 abre direto no lançamento (útil para atalho na tela de início)
  const [sheet, setSheet] = useState<{ tx: Tx | null } | null>(() =>
    new URLSearchParams(location.search).has('add') ? { tx: null } : null,
  )
  const [toast, setToast] = useState<{ msg: string; undo?: () => void } | null>(null)
  const toastTimer = useRef<number | undefined>(undefined)

  const notify = useCallback((msg: string, undo?: () => void) => {
    clearTimeout(toastTimer.current)
    setToast({ msg, undo })
    toastTimer.current = window.setTimeout(() => setToast(null), undo ? 4000 : 2200)
  }, [])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [tab])

  const open = (tx: Tx | null) => setSheet({ tx })

  return (
    <div className="app">
      {!ready ? (
        <div className="screen"><div className="empty">Carregando…</div></div>
      ) : tab === 'home' ? (
        <Home month={month} setMonth={setMonth} onOpen={open} onAdd={() => open(null)} goTo={setTab} />
      ) : tab === 'list' ? (
        <History month={month} setMonth={setMonth} onOpen={open} />
      ) : tab === 'insights' ? (
        <Insights month={month} setMonth={setMonth} />
      ) : (
        <Settings notify={notify} />
      )}

      <nav className="tabbar">
        <div className="tabbar-in">
          <button className={`tab${tab === 'home' ? ' on' : ''}`} onClick={() => setTab('home')}><IconHome />Início</button>
          <button className={`tab${tab === 'list' ? ' on' : ''}`} onClick={() => setTab('list')}><IconList />Extrato</button>
          <button className="fab" onClick={() => open(null)} aria-label="Adicionar"><IconPlus /></button>
          <button className={`tab${tab === 'insights' ? ' on' : ''}`} onClick={() => setTab('insights')}><IconChart />Análise</button>
          <button className={`tab${tab === 'settings' ? ' on' : ''}`} onClick={() => setTab('settings')}><IconGear />Ajustes</button>
        </div>
      </nav>

      {sheet && (
        <AddSheet
          key={sheet.tx?.id ?? 'new'}
          editing={sheet.tx}
          onClose={() => setSheet(null)}
          onSaved={(tx, isNew) => {
            setSheet(null)
            setMonth(monthKey(new Date(tx.occurred_at)))
            notify(isNew ? `${tx.kind === 'income' ? '+' : '−'}${brl(tx.amount)} adicionado` : 'Alterações salvas')
          }}
          onDeleted={(tx) => {
            setSheet(null)
            notify('Lançamento excluído', () => {
              saveTx(tx)
              setToast(null)
            })
          }}
        />
      )}

      {toast && (
        <div className="toast">
          {toast.msg}
          {toast.undo && <button onClick={toast.undo}>Desfazer</button>}
        </div>
      )}
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  if (session === undefined) return null
  if (!session) return <Login />
  return (
    <StoreProvider key={session.user.id} userId={session.user.id}>
      <Shell />
    </StoreProvider>
  )
}
