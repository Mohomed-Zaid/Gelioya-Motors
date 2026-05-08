import { Sidebar } from '../components/Sidebar'

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#021b1a] via-[#022c2b] to-[#021b1a]">
      <Sidebar />
      <main className="lg:ml-[260px] min-h-screen transition-all duration-300">
        <div className="p-4 lg:p-8 pt-16 lg:pt-8 max-w-[1400px] mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
