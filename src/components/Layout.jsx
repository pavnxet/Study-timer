import { Outlet, Link, useLocation } from 'react-router-dom'
import { Home, Timer as TimerIcon, Settings } from 'lucide-react'
import { cn } from '../lib/utils'

export default function Layout() {
  const location = useLocation()

  const navItems = [
    { name: 'Dashboard', path: '/', icon: Home },
    { name: 'Timer', path: '/timer', icon: TimerIcon },
    { name: 'Sync', path: '/settings', icon: Settings },
  ]

  return (
    <div className="flex flex-col min-h-screen bg-neutral-900 text-white font-sans">
      <main className="flex-1 overflow-y-auto pb-20 p-4">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-neutral-800 border-t border-neutral-700 z-50">
        <div className="flex justify-around items-center h-16 max-w-md mx-auto">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.path

            return (
              <Link
                key={item.name}
                to={item.path}
                className={cn(
                  "flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors duration-200",
                  isActive ? "text-indigo-400" : "text-neutral-400 hover:text-neutral-200"
                )}
              >
                <Icon className="w-6 h-6" />
                <span className="text-xs font-medium">{item.name}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
