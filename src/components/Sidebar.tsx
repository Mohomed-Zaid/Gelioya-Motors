import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  ShoppingCart,
  Truck,
  HandCoins,
  CreditCard,
  Users,
  BookOpen,
  BookMarked,
  Receipt,
  BarChart3,
  Settings,
  Menu,
  X,
  Wrench,
  RotateCcw,
  LogOut,
  ChevronDown,
  ChevronUp,
  Shield,
} from 'lucide-react'

type NavItem = {
  to: string
  label: string
  icon: React.ComponentType<{ size?: number }>
}

type NavSection = {
  key: string
  label: string
  collapsible?: boolean
  items: NavItem[]
}

const navSections: NavSection[] = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    items: [{ to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    key: 'inventory',
    label: 'Inventory',
    collapsible: true,
    items: [
      { to: '/purchases', label: 'Purchases', icon: Truck },
      { to: '/returns', label: 'Returns', icon: RotateCcw },
    ],
  },
  {
    key: 'finance',
    label: 'Finance',
    collapsible: true,
    items: [
      { to: '/receivables', label: 'Receivables', icon: HandCoins },
      { to: '/payables', label: 'Payables', icon: CreditCard },
      { to: '/parties', label: 'Parties', icon: Users },
      { to: '/cash-ledger', label: 'Cash Ledger', icon: BookOpen },
      { to: '/expenses', label: 'Expenses', icon: Receipt },
      { to: '/manual-profit-loss', label: 'Manual P&L', icon: BookMarked },
      { to: '/reports', label: 'Reports', icon: BarChart3 },
    ],
  },
  {
    key: 'sales',
    label: 'Sales / Invoices',
    items: [{ to: '/sales', label: 'Sales / Invoices', icon: ShoppingCart }],
  },
  {
    key: 'admin',
    label: 'Admin',
    collapsible: true,
    items: [
      { to: '/admin', label: 'Backup & Restore', icon: Shield },
    ],
  },
  {
    key: 'settings',
    label: 'Settings',
    items: [{ to: '/settings', label: 'Settings', icon: Settings }],
  },
]

export function Sidebar() {
  const { signOut } = useAuth()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    dashboard: false,
    inventory: false,
    sales: false,
    finance: false,
    admin: false,
    settings: false,
  })

  const linkClass = (isActive: boolean) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
      isActive
        ? 'bg-white/90 text-blue-700 shadow-sm shadow-blue-100'
        : 'text-blue-100/80 hover:bg-white/10 hover:text-white'
    }`

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-[60] bg-white p-2.5 rounded-xl shadow-lg shadow-slate-200/50 border border-slate-100"
      >
        <Menu size={20} className="text-slate-700" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full z-50 flex flex-col transition-all duration-300 ease-in-out surface-2 ${
          collapsed ? 'w-[72px]' : 'w-[260px]'
        } ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center border border-emerald-900/30 overflow-hidden bg-white/90">
              <img src="/Gelioya motors logo 01.png" alt="GM" className="w-8 h-8 object-contain" />
            </div>
            {!collapsed && (
              <div className="animate-fade-in">
                <h1 className="text-sm font-bold text-white leading-tight">Gelioya Motors</h1>
                <p className="text-[11px] text-slate-300/80">Business Manager</p>
              </div>
            )}
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden p-1.5 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X size={16} className="text-white" />
          </button>
        </div>

        {/* Divider */}
        <div className="mx-4 h-px bg-emerald-900/30" />

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 space-y-3 overflow-y-auto scrollbar-thin">
          {navSections.map((section) => {
            const isOpen = !!openSections[section.key]

            if (collapsed) {
              return (
                <div key={section.key} className="space-y-1">
                  {section.items.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => setMobileOpen(false)}
                      className={({ isActive }) => linkClass(isActive)}
                    >
                      <item.icon size={19} />
                    </NavLink>
                  ))}
                </div>
              )
            }

            const showToggle = section.collapsible || section.items.length > 1

            return (
              <div key={section.key} className="space-y-1">
                <button
                  type="button"
                  onClick={() =>
                    setOpenSections((s) => ({
                      ...s,
                      [section.key]: showToggle ? !s[section.key] : true,
                    }))
                  }
                  className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-300/80 hover:text-white transition-colors"
                >
                  <span>{section.label}</span>
                  {showToggle && (
                    <span className="text-slate-400">
                      {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </span>
                  )}
                </button>

                {(isOpen || !showToggle) && (
                  <div className="space-y-1">
                    {section.items.map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        onClick={() => setMobileOpen(false)}
                        className={({ isActive }) => linkClass(isActive)}
                      >
                        <item.icon size={19} />
                        <span>{item.label}</span>
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="px-3 py-3">
          {!collapsed && (
            <div className="bg-white/10 rounded-xl p-3 mb-3">
              <p className="text-[11px] text-blue-200/80 font-medium">Gelioya Motors</p>
              <p className="text-[10px] text-blue-300/60 mt-0.5">Value-based Inventory System</p>
            </div>
          )}
          <button
            onClick={signOut}
            className="flex items-center gap-2 px-3 py-2 text-xs text-blue-200/60 hover:text-red-300 hover:bg-red-950/30 rounded-xl w-full transition-colors"
          >
            <LogOut size={16} />
            {!collapsed && <span>Sign Out</span>}
          </button>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex items-center gap-2 px-3 py-2 text-xs text-blue-200/60 hover:text-white hover:bg-white/10 rounded-xl w-full transition-colors"
          >
            {collapsed ? <Menu size={16} /> : <X size={16} />}
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>
    </>
  )
}
