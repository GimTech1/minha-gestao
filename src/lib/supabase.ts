import { createClient } from '@supabase/supabase-js'

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
export const INGEST_URL = `${SUPABASE_URL}/functions/v1/ingest`

// Lido antes de criar o cliente, que limpa o #hash da URL ao processar o link do e-mail
export const OPENED_FROM_RECOVERY_LINK = /type=recovery/.test(window.location.hash)

export const supabase = createClient(SUPABASE_URL, import.meta.env.VITE_SUPABASE_KEY as string, {
  // implicit: o link de recuperação de senha funciona mesmo abrindo no Safari em vez do app instalado
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' },
})
