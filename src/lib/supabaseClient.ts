import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

const isConfigured = supabaseUrl && supabaseAnonKey &&
  (supabaseUrl.startsWith('http://') || supabaseUrl.startsWith('https://'))

// Custom storage using sessionStorage — survives refresh, cleared on tab close
const sessionStorageAdapter = {
  getItem: (key: string) => sessionStorage.getItem(key),
  setItem: (key: string, value: string) => sessionStorage.setItem(key, value),
  removeItem: (key: string) => sessionStorage.removeItem(key),
}

export const supabase: SupabaseClient | null = isConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: sessionStorageAdapter,
      },
    })
  : null

export function isSupabaseConfigured(): boolean {
  return !!isConfigured
}
