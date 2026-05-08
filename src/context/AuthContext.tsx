import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { User, Session } from '@supabase/supabase-js'

const SESSION_FLAG = 'gm_active_session'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }

    // Check our sessionStorage flag — only exists if user logged in THIS tab
    const isActiveSession = sessionStorage.getItem(SESSION_FLAG)

    if (!isActiveSession) {
      // New tab (or tab was closed and reopened) — force sign out
      supabase.auth.signOut().finally(() => {
        setSession(null)
        setUser(null)
        setLoading(false)
      })
    } else {
      // Refresh within same tab — restore session
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          setSession(session)
          setUser(session?.user ?? null)
        } else {
          // Session expired on server side
          sessionStorage.removeItem(SESSION_FLAG)
          setSession(null)
          setUser(null)
        }
        setLoading(false)
      }).catch(() => {
        sessionStorage.removeItem(SESSION_FLAG)
        setLoading(false)
      })
    }

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error('Supabase is not configured')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    // Mark this tab as having an active session
    sessionStorage.setItem(SESSION_FLAG, 'true')
  }, [])

  const signUp = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error('Supabase is not configured')
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
    sessionStorage.setItem(SESSION_FLAG, 'true')
  }, [])

  const signOut = useCallback(async () => {
    if (!supabase) throw new Error('Supabase is not configured')
    const { error } = await supabase.auth.signOut()
    sessionStorage.removeItem(SESSION_FLAG)
    if (error) throw error
  }, [])

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
