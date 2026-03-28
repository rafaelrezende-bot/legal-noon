"use client"
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard } from 'lucide-react'

const nav = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
]

export function Sidebar() {
  const pathname = usePathname()
  return (
    <aside className="fixed left-0 top-0 h-screen w-[260px] flex flex-col" style={{ backgroundColor: '#0F334D' }}>
      <div className="p-6">
        <h1 className="text-xl font-bold text-white">Legal Noon</h1>
        <p className="text-xs mt-1" style={{ color: '#8CB8D4' }}>Noon Capital Partners</p>
      </div>
      <nav className="flex-1 px-3">
        {nav.map(item => {
          const active = pathname === item.href
          return (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 text-sm transition-colors ${
                active
                  ? 'font-semibold text-white border-l-3'
                  : 'font-medium hover:text-white'
              }`}
              style={
                active
                  ? { backgroundColor: '#1A4D6E', borderLeft: '3px solid #8CB8D4' }
                  : {}
              }>
              <item.icon className="w-5 h-5" style={{ color: active ? '#FFFFFF' : '#8CB8D4' }} />
              <span style={{ color: active ? '#FFFFFF' : '#B8D4E8' }}>{item.label}</span>
            </Link>
          )
        })}
      </nav>
      <div className="p-4" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold" style={{ backgroundColor: '#1A4D6E', color: '#FFFFFF' }}>T</div>
          <div>
            <p className="text-sm font-medium text-white">Tereza Cidade</p>
            <p className="text-xs" style={{ color: '#8CB8D4' }}>Compliance</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
