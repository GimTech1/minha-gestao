import { createClient } from '@supabase/supabase-js'

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
export const INGEST_URL = `${SUPABASE_URL}/functions/v1/ingest`

export const supabase = createClient(SUPABASE_URL, import.meta.env.VITE_SUPABASE_KEY as string, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})
