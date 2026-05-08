import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { isSupabaseConfigured } from '../lib/supabaseClient'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (!isSupabaseConfigured()) {
    return <Navigate to="/setup" replace />
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#021b1a] via-[#022c2b] to-[#021b1a] flex items-center justify-center text-slate-400 text-sm">
        Loading...
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}
