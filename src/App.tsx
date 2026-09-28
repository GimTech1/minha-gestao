import { useCallback, useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, OPENED_FROM_RECOVERY_LINK } from './lib/supabase'
import { PasswordFields } from './components/PasswordFields'
import { StoreProvider, useStore, type Tx } from './lib/store'
import { Login } from './screens/Login'
import { Home } from './screens/Home'
import { History, type ListView } from './screens/History'
import { Insights } from './screens/Insights'
import { Settings } from './screens/Settings'
import { AddSheet } from './components/AddSheet'
import { PlannedSheet } from './components/PlannedSheet'
import { OccurrenceSheet } from './components/OccurrenceSheet'
import { paymentTx } from './lib/usePlanned'
import type { Occurrence, Planned } from './lib/planned'
import { IconChart, IconGear, IconHome, IconList, IconPlus } from './components/icons'
import { brl, monthKey } from './lib/format'

type Tab = 'home' | 'list' | 'insights' | 'settings'

function Shell() {
  const { saveTx, deleteTx, ready, planned } = useStore()
  const [tab, setTab] = useState<Tab>('home')
  const [month, setMonth] = useState(monthKey(new Date()))
  // ?add=1 abre direto no lançamento (útil para atalho na tela de início)
  const [sheet, setSheet] = useState<{ tx: Tx | null } | null>(() =>
    new URLSearchParams(location.search).has('add') ? { tx: null } : null,
  )
  const [listView, setListView] = useState<ListView>('txs')
  const [occSheet, setOccSheet] = useState<Occurrence | null>(null)
  const [planSheet, setPlanSheet] = useState<{ p: Planned | null } | null>(null)
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

  const payNow = (o: Occurrence) => {
    const tx = paymentTx(o)
    saveTx(tx)
    notify(`✓ ${o.label} ${o.planned.kind === 'income' ? 'recebido' : 'pago'}`, () => {
      deleteTx(tx.id)
      setToast(null)
    })
  }

  const changeListView = (v: ListView) => {
    setListView(v)
    if (v === 'txs' && month > monthKey(new Date())) setMonth(monthKey(new Date()))
  }

  const goTo = (t: Tab, view?: ListView) => {
    if (view) changeListView(view)
    setTab(t)
  }

  return (
    <div className="app">
      {!ready ? (
        <div className="screen"><div className="empty">Carregando…</div></div>
      ) : tab === 'home' ? (
        <Home
          month={month}
          setMonth={setMonth}
          onOpen={open}
          onAdd={() => open(null)}
          goTo={goTo}
          onOpenOcc={setOccSheet}
          onPay={payNow}
          onNewPlanned={() => setPlanSheet({ p: null })}
        />
      ) : tab === 'list' ? (
        <History
          month={month}
          setMonth={setMonth}
          onOpen={open}
          view={listView}
          setView={changeListView}
          onOpenOcc={setOccSheet}
          onPay={payNow}
          onNewPlanned={() => setPlanSheet({ p: null })}
        />
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
            const plan = isNew && tx.planned_id ? planned.find((p) => p.id === tx.planned_id) : undefined
            notify(
              plan
                ? `✓ ${plan.description} marcada como ${tx.kind === 'income' ? 'recebida' : 'paga'}`
                : isNew
                  ? `${tx.kind === 'income' ? '+' : '−'}${brl(tx.amount)} adicionado`
                  : 'Alterações salvas',
            )
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

      {occSheet && (
        <OccurrenceSheet
          o={occSheet}
          onClose={() => setOccSheet(null)}
          onEdit={() => {
            setPlanSheet({ p: occSheet.planned })
            setOccSheet(null)
          }}
          notify={notify}
        />
      )}

      {planSheet && <PlannedSheet key={planSheet.p?.id ?? 'new'} editing={planSheet.p} onClose={() => setPlanSheet(null)} notify={notify} />}

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
  const [recovering, setRecovering] = useState(OPENED_FROM_RECOVERY_LINK)
  const [recovered, setRecovered] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
      setSession(s)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  if (session === undefined) return null
  if (recovering && session) {
    return (
      <div className="login">
        <img className="logo" src={`${import.meta.env.BASE_URL}icon-192.png`} alt="" />
        {recovered ? (
          <>
            <h1>Senha alterada ✓</h1>
            <p className="sub">
              Pronto! Se você usa o app instalado na tela de início, abra ele e entre com a nova senha.
            </p>
            <button className="btn" onClick={() => setRecovering(false)}>Continuar aqui</button>
          </>
        ) : (
          <>
            <h1>Criar nova senha</h1>
            <p className="sub">Para {session.user.email}</p>
            <PasswordFields onDone={() => setRecovered(true)} />
          </>
        )}
      </div>
    )
  }
  if (!session) return <Login />
  return (
    <StoreProvider key={session.user.id} userId={session.user.id}>
      <Shell />
    </StoreProvider>
  )
}
