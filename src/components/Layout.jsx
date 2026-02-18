import { Outlet, Link, useLocation } from 'react-router-dom'
import { Home, Timer as TimerIcon, Settings, WifiOff } from 'lucide-react'
import { cn } from '../lib/utils'
import { useState, useEffect } from 'react'
import { useStudyData } from '../hooks/useStudyData'

export default function Layout() {
  const location = useLocation()
  const [isOffline, setIsOffline] = useState(!navigator.onLine)
  const { fetchSettings } = useStudyData()
  const [currentTheme, setCurrentTheme] = useState('default')

  useEffect(() => {
      const loadTheme = async () => {
          const { settings } = await fetchSettings()
          if (settings && settings.theme) {
              setCurrentTheme(settings.theme)
              document.documentElement.setAttribute('data-theme', settings.theme)
          } else {
              document.documentElement.removeAttribute('data-theme')
          }
      }
      loadTheme()
  }, [fetchSettings])

  useEffect(() => {
      const handleOnline = () => setIsOffline(false)
      const handleOffline = () => setIsOffline(true)

      window.addEventListener('online', handleOnline)
      window.addEventListener('offline', handleOffline)

      return () => {
          window.removeEventListener('online', handleOnline)
          window.removeEventListener('offline', handleOffline)
      }
  }, [])

  const navItems = [
    { name: 'Dashboard', path: '/', icon: Home },
    { name: 'Timer', path: '/timer', icon: TimerIcon },
    { name: 'Sync', path: '/settings', icon: Settings },
  ]

  return (
    <div className="flex flex-col min-h-screen bg-neutral-900 text-white font-sans">
      {isOffline && (
          <div className="bg-amber-600 text-white text-xs font-medium text-center py-1 px-4 sticky top-0 z-50 flex items-center justify-center gap-2">
              <WifiOff className="w-3 h-3" />
              You are offline. Data will be saved locally.
          </div>
      )}

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
