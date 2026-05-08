import { ReactNode } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface SummaryCardProps {
  title: string
  value: string
  icon: ReactNode
  trend?: 'up' | 'down'
  trendLabel?: string
  color?: 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'slate'
}

const gradientMap = {
  blue: 'from-emerald-500/60 to-teal-400/40',
  green: 'from-emerald-500/60 to-emerald-300/40',
  amber: 'from-amber-400/60 to-yellow-300/40',
  red: 'from-red-500/60 to-rose-400/40',
  purple: 'from-violet-400/60 to-fuchsia-300/40',
  slate: 'from-slate-400/50 to-slate-300/30',
}

const iconBgMap = {
  blue: 'bg-emerald-500/15',
  green: 'bg-emerald-500/15',
  amber: 'bg-amber-400/15',
  red: 'bg-red-500/15',
  purple: 'bg-violet-400/15',
  slate: 'bg-slate-300/10',
}

export function SummaryCard({ title, value, icon, trend, trendLabel, color = 'blue' }: SummaryCardProps) {
  return (
    <div className="surface rounded-2xl p-5 card-hover">
      <div className={`h-1 w-full rounded-full bg-gradient-to-r ${gradientMap[color]} mb-4`} />
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-300">{title}</p>
          <p className="mt-2 text-2xl font-bold truncate text-slate-100">{value}</p>
          {trendLabel && (
            <div className="mt-2 flex items-center gap-1 text-xs text-slate-300">
              {trend === 'up' && <TrendingUp size={14} />}
              {trend === 'down' && <TrendingDown size={14} />}
              <span>{trendLabel}</span>
            </div>
          )}
        </div>
        <div className={`p-2.5 rounded-xl ${iconBgMap[color]} text-slate-100`}>{icon}</div>
      </div>
    </div>
  )
}
