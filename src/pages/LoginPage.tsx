import { useState } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { Wrench, Mail, Lock, Eye, EyeOff, ArrowRight, ArrowLeft } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { isSupabaseConfigured } from '../lib/supabaseClient'

export function LoginPage() {
  const { user, loading, signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!isSupabaseConfigured()) return <Navigate to="/setup" replace />
  if (loading) return <div className="min-h-screen bg-gradient-to-br from-[#021b1a] via-[#022c2b] to-[#021b1a] flex items-center justify-center text-slate-400 text-sm">Loading...</div>
  if (user) return <Navigate to="/dashboard" replace />

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!email.trim()) { setError('Email is required'); return }
    if (!password) { setError('Password is required'); return }
    setSubmitting(true)
    try {
      await signIn(email.trim(), password)
    } catch (err: any) {
      setError(err?.message || 'Invalid email or password')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#021b1a] via-[#022c2b] to-[#021b1a] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-6">
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-emerald-300 transition-colors">
            <ArrowLeft size={14} />
            Back to Website
          </Link>
        </div>
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white/90 rounded-2xl border border-emerald-900/30 mb-4 overflow-hidden">
            <img src="/Gelioya motors logo 01.png" alt="Gelioya Motors" className="w-16 h-16 object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-white">Gelioya Motors</h1>
          <p className="text-sm text-slate-400 mt-1">Business Manager</p>
        </div>

        <div className="surface rounded-2xl p-6 sm:p-8">
          <h2 className="text-xl font-bold text-slate-100 mb-1">Sign In</h2>
          <p className="text-sm text-slate-400 mb-6">Enter your credentials to continue</p>

          {error && <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-900/30 text-red-300 text-sm">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="w-full pl-10 pr-4 py-3 input-surface rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none" required autoComplete="email" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input type={showPw ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="w-full pl-10 pr-11 py-3 input-surface rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none" required autoComplete="current-password" />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">{showPw ? <EyeOff size={16} /> : <Eye size={16} />}</button>
              </div>
            </div>
            <button type="submit" disabled={submitting} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white font-semibold rounded-xl transition-colors text-sm">
              {submitting ? <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <>Sign In<ArrowRight size={16} /></>}
            </button>
          </form>

        </div>
      </div>
    </div>
  )
}
