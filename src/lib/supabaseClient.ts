import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

const isConfigured = supabaseUrl && supabaseAnonKey &&
  (supabaseUrl.startsWith('http://') || supabaseUrl.startsWith('https://'))

export const supabase: SupabaseClient | null = isConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

export function isSupabaseConfigured(): boolean {
  return !!isConfigured
}
