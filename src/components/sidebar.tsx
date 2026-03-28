"use client"
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, MessageSquare } from 'lucide-react'

const nav = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Assistente IA', href: '/chat', icon: MessageSquare },
]

export function Sidebar() {
  const pathname = usePathname()
  return (
    <aside className="fixed left-0 top-0 h-screen w-[260px] border-r border-gray-200 bg-white flex flex-col">
      <div className="p-6">
        <h1 className="text-xl font-bold" style={{ color: '#0F334D' }}>Legal Noon</h1>
        <p className="text-xs text-gray-400 mt-1">Noon Capital Partners</p>
      </div>
      <nav className="flex-1 px-3">
        {nav.map(item => {
          const active = pathname === item.href
          return (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 text-sm transition-colors ${
                active ? 'font-semibold text-[#0F334D] bg-[#EBF5FA]' : 'text-gray-500 hover:bg-gray-50 font-medium'
              }`}>
              <item.icon className="w-5 h-5" />
              {item.label}
            </Link>
          )
        })}
      </nav>
      <div className="p-4 border-t border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#1E7FA8] flex items-center justify-center text-white text-sm font-semibold">T</div>
          <div>
            <p className="text-sm font-medium text-gray-900">Tereza Cidade</p>
            <p className="text-xs text-gray-400">Compliance</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
