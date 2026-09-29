// Estado do app: carrega do cache local na hora (abre instantâneo), sincroniza com o Supabase,
// grava de forma otimista e guarda uma fila offline quando a rede falha.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { supabase } from './supabase'
import type { Planned } from './planned'

export type Kind = 'expense' | 'income'

export interface Category {
  id: string
  name: string
  emoji: string
  color: string
  kind: Kind
  keywords: string[]
  sort: number
}

export interface Tx {
  id: string
  kind: Kind
  amount: number
  category_id: string | null
  description: string | null
  method: string | null
  occurred_at: string
  source: 'manual' | 'auto'
  created_at?: string
  planned_id?: string | null
  planned_month?: string | null
}

export interface Profile {
  id: string
  name: string | null
  monthly_budget: number | null
  savings_goal: number | null
  balance_amount: number | null
  balance_at: string | null
  ingest_token: string
}

type PendingOp = { op: 'upsert'; row: Tx } | { op: 'delete'; id: string }

interface Store {
  ready: boolean
  syncing: boolean
  pending: number
  profile: Profile | null
  categories: Category[]
  txs: Tx[]
  planned: Planned[]
  catById: Map<string, Category>
  saveTx: (tx: Tx) => void
  deleteTx: (id: string) => void
  saveCategory: (c: Partial<Category> & { name: string; kind: Kind }) => Promise<void>
  deleteCategory: (id: string) => Promise<void>
  updateProfile: (p: Partial<Profile>) => Promise<void>
  rotateToken: () => Promise<void>
  savePlanned: (p: Planned) => Promise<void>
  deletePlanned: (id: string) => Promise<void>
  refresh: () => Promise<void>
}

const Ctx = createContext<Store | null>(null)
export const useStore = () => useContext(Ctx)!

const TX_COLS = 'id, kind, amount, category_id, description, method, occurred_at, source, created_at, planned_id, planned_month'
const PLAN_COLS = 'id, kind, amount, description, category_id, method, type, day, start_month, installments, end_month, skipped_months, tentative'
const toPlanned = (r: Record<string, unknown>): Planned => ({ ...(r as unknown as Planned), amount: Number(r.amount) })
const sortTx = (a: Tx, b: Tx) => b.occurred_at.localeCompare(a.occurred_at)
const toTx = (r: Record<string, unknown>): Tx => ({ ...(r as unknown as Tx), amount: Number(r.amount) })

function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key)
    return v ? (JSON.parse(v) as T) : fallback
  } catch {
    return fallback
  }
}
function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* armazenamento indisponível: segue só em memória */
  }
}

export function StoreProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const cacheKey = `mg-cache-v1-${userId}`
  const queueKey = `mg-queue-v1-${userId}`
  const cached = useMemo(
    () => load<{ profile: Profile | null; categories: Category[]; txs: Tx[]; planned?: Planned[] } | null>(cacheKey, null),
    [cacheKey],
  )

  const [profile, setProfile] = useState<Profile | null>(cached?.profile ?? null)
  const [categories, setCategories] = useState<Category[]>(cached?.categories ?? [])
  const [txs, setTxs] = useState<Tx[]>(cached?.txs ?? [])
  const [planned, setPlanned] = useState<Planned[]>(cached?.planned ?? [])
  const [ready, setReady] = useState(!!cached)
  const [syncing, setSyncing] = useState(false)
  const [queue, setQueue] = useState<PendingOp[]>(() => load(queueKey, []))
  const flushing = useRef(false)

  useEffect(() => {
    if (ready) save(cacheKey, { profile, categories, txs, planned })
  }, [ready, profile, categories, txs, planned, cacheKey])
  useEffect(() => {
    save(queueKey, queue)
  }, [queue, queueKey])

  const refresh = useCallback(async () => {
    setSyncing(true)
    try {
      const [p, c, t, pl] = await Promise.all([
        supabase.from('profiles').select('id, name, monthly_budget, savings_goal, balance_amount, balance_at, ingest_token').eq('id', userId).maybeSingle(),
        supabase.from('categories').select('id, name, emoji, color, kind, keywords, sort').order('sort'),
        supabase.from('transactions').select(TX_COLS).order('occurred_at', { ascending: false }).range(0, 9999),
        supabase.from('planned').select(PLAN_COLS).order('created_at'),
      ])
      if (pl.data) setPlanned(pl.data.map(toPlanned))
      if (p.data)
        setProfile({
          ...p.data,
          monthly_budget: p.data.monthly_budget == null ? null : Number(p.data.monthly_budget),
          savings_goal: p.data.savings_goal == null ? null : Number(p.data.savings_goal),
          balance_amount: p.data.balance_amount == null ? null : Number(p.data.balance_amount),
        })
      if (c.data) setCategories(c.data as Category[])
      if (t.data) {
        // O que ainda está na fila offline vence o que veio do servidor
        const ops = load<PendingOp[]>(queueKey, [])
        const upserts = new Map(ops.flatMap((o) => (o.op === 'upsert' ? [[o.row.id, o.row] as const] : [])))
        const deletes = new Set(ops.flatMap((o) => (o.op === 'delete' ? [o.id] : [])))
        const server = t.data.map(toTx).filter((s) => !deletes.has(s.id) && !upserts.has(s.id))
        setTxs([...server, ...upserts.values()].sort(sortTx))
      }
      if (!p.error && !c.error && !t.error) setReady(true)
    } finally {
      setSyncing(false)
    }
  }, [userId, queueKey])

  const flush = useCallback(async () => {
    if (flushing.current) return
    flushing.current = true
    try {
      let ops = load<PendingOp[]>(queueKey, [])
      while (ops.length) {
        const op = ops[0]
        const { error } =
          op.op === 'upsert'
            ? await supabase.from('transactions').upsert({
                id: op.row.id,
                kind: op.row.kind,
                amount: op.row.amount,
                category_id: op.row.category_id,
                description: op.row.description,
                method: op.row.method,
                occurred_at: op.row.occurred_at,
                source: op.row.source,
                planned_id: op.row.planned_id ?? null,
                planned_month: op.row.planned_month ?? null,
              })
            : await supabase.from('transactions').delete().eq('id', op.id)
        // Erro de rede: tenta de novo depois. Erro do banco: descarta para não travar a fila.
        if (error && (error.message.includes('Failed to fetch') || error.message.includes('NetworkError') || error.message.includes('Load failed'))) break
        if (error) console.error('Falha ao sincronizar', error)
        ops = ops.slice(1)
        save(queueKey, ops)
        setQueue(ops)
      }
    } finally {
      flushing.current = false
    }
  }, [queueKey])

  const enqueue = useCallback(
    (op: PendingOp) => {
      const ops = [...load<PendingOp[]>(queueKey, []), op]
      save(queueKey, ops)
      setQueue(ops)
      void flush()
    },
    [queueKey, flush],
  )

  useEffect(() => {
    void flush().then(refresh)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void flush().then(refresh)
    }
    const onOnline = () => void flush().then(refresh)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onOnline)

    // Tempo real: lançamentos que chegam pelos Atalhos aparecem na hora
    const channel = supabase
      .channel(`tx-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions', filter: `user_id=eq.${userId}` }, (payload) => {
        if (payload.eventType === 'DELETE') {
          const id = (payload.old as { id: string }).id
          setTxs((prev) => prev.filter((t) => t.id !== id))
        } else {
          const row = toTx(payload.new)
          setTxs((prev) => [row, ...prev.filter((t) => t.id !== row.id)].sort(sortTx))
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'planned', filter: `user_id=eq.${userId}` }, (payload) => {
        if (payload.eventType === 'DELETE') {
          const id = (payload.old as { id: string }).id
          setPlanned((prev) => prev.filter((p) => p.id !== id))
        } else {
          const row = toPlanned(payload.new)
          setPlanned((prev) => [...prev.filter((p) => p.id !== row.id), row])
        }
      })
      .subscribe()

    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onOnline)
      void supabase.removeChannel(channel)
    }
  }, [userId, flush, refresh])

  const saveTx = useCallback(
    (tx: Tx) => {
      setTxs((prev) => [tx, ...prev.filter((t) => t.id !== tx.id)].sort(sortTx))
      enqueue({ op: 'upsert', row: tx })
    },
    [enqueue],
  )

  const deleteTx = useCallback(
    (id: string) => {
      setTxs((prev) => prev.filter((t) => t.id !== id))
      enqueue({ op: 'delete', id })
    },
    [enqueue],
  )

  const saveCategory = useCallback(async (c: Partial<Category> & { name: string; kind: Kind }) => {
    const row = { ...c, id: c.id ?? crypto.randomUUID() }
    setCategories((prev) => [...prev.filter((x) => x.id !== row.id), row as Category].sort((a, b) => a.sort - b.sort))
    const { error } = await supabase.from('categories').upsert(row)
    if (error) throw error
  }, [])

  const deleteCategory = useCallback(async (id: string) => {
    setCategories((prev) => prev.filter((c) => c.id !== id))
    setTxs((prev) => prev.map((t) => (t.category_id === id ? { ...t, category_id: null } : t)))
    const { error } = await supabase.from('categories').delete().eq('id', id)
    if (error) throw error
  }, [])

  const updateProfile = useCallback(
    async (p: Partial<Profile>) => {
      setProfile((prev) => (prev ? { ...prev, ...p } : prev))
      const { error } = await supabase.from('profiles').update(p).eq('id', userId)
      if (error) throw error
    },
    [userId],
  )

  const rotateToken = useCallback(async () => {
    const { data, error } = await supabase.rpc('rotate_ingest_token')
    if (error) throw error
    setProfile((prev) => (prev ? { ...prev, ingest_token: data as string } : prev))
  }, [])

  const savePlanned = useCallback(async (p: Planned) => {
    setPlanned((prev) => [...prev.filter((x) => x.id !== p.id), p])
    const { error } = await supabase.from('planned').upsert(p)
    if (error) throw error
  }, [])

  const deletePlanned = useCallback(async (id: string) => {
    setPlanned((prev) => prev.filter((p) => p.id !== id))
    setTxs((prev) => prev.map((t) => (t.planned_id === id ? { ...t, planned_id: null, planned_month: null } : t)))
    const { error } = await supabase.from('planned').delete().eq('id', id)
    if (error) throw error
  }, [])

  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])

  const value: Store = {
    ready,
    syncing,
    pending: queue.length,
    profile,
    categories,
    txs,
    planned,
    catById,
    saveTx,
    deleteTx,
    saveCategory,
    deleteCategory,
    updateProfile,
    rotateToken,
    savePlanned,
    deletePlanned,
    refresh,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
