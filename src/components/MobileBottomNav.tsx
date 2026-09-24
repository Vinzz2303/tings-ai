import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Home, PieChart, MessageSquare, Zap } from 'lucide-react'
import { useAuthSession } from '../utils/useAuthSession'
import { hasProAccess } from '../utils/entitlements'
import { isPersonalDomain } from '../utils/domain'

export default function MobileBottomNav() {
  const location = useLocation()
  
  // Hide on personal domain and public auth pages
  const hiddenPaths = ['/login', '/signup', '/forgot', '/reset', '/verify-email', '/']
  if (isPersonalDomain() || hiddenPaths.includes(location.pathname)) {
    return null
  }

  const { user } = useAuthSession()
  const isPro = hasProAccess(user)

  const navItems = [
    { label: 'Hari Ini', path: '/komando-pagi', icon: <Home className="w-5 h-5" /> },
    { label: 'Portfolio', path: '/portfolio', icon: <PieChart className="w-5 h-5" /> },
    { label: 'Tanya AI', path: '/ting-ai', icon: <MessageSquare className="w-5 h-5" /> },
    ...(!isPro ? [{ label: 'Pro', path: '/upgrade', icon: <Zap className="w-5 h-5" /> }] : [])
  ]

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0b0d12]/95 backdrop-blur border-t border-white/10" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex justify-around items-center h-16">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || (item.path === '/komando-pagi' && location.pathname === '/dashboard')
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
                isActive ? 'text-primary' : 'text-white/50 hover:text-white/80'
              }`}
            >
              {item.icon}
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
