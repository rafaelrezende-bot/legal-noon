"use client"
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, FileText, Users, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const nav = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Documentos', href: '/admin/documentos', icon: FileText },
  { label: 'Usuários', href: '/admin/usuarios', icon: Users },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [userName, setUserName] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [userInitial, setUserInitial] = useState('U')

  const supabase = createClient()

  useEffect(() => {
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      setUserEmail(user.email || null)

      const { data: invited } = await supabase
        .from('invited_users')
        .select('name')
        .eq('email', user.email)
        .single()

      const name = invited?.name || user.user_metadata?.name || null
      if (name) {
        setUserName(name)
        setUserInitial(name.charAt(0).toUpperCase())
      } else if (user.email) {
        setUserName(user.email)
        setUserInitial(user.email.charAt(0).toUpperCase())
      }
    }
    loadUser()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

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
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold" style={{ backgroundColor: '#1A4D6E', color: '#FFFFFF' }}>{userInitial}</div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-white truncate">{userName || 'Carregando...'}</p>
            {userEmail && <p className="text-xs truncate" style={{ color: '#8CB8D4' }}>{userEmail}</p>}
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-sm w-full px-1 py-1.5 rounded transition-colors hover:text-white"
          style={{ color: '#B8D4E8' }}
        >
          <LogOut className="w-4 h-4" />
          Sair
        </button>
      </div>
    </aside>
  )
}
