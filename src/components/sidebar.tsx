"use client"
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { CalendarDays, FileText, GraduationCap, Briefcase, Users, LogOut, Search } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useUserRole } from '@/hooks/use-user-role'

const baseNav = [
  { label: 'Calendário', href: '/', icon: CalendarDays, adminOnly: false },
  { label: 'Documentos', href: '/admin/documentos', icon: FileText, adminOnly: false },
  { label: 'Treinamentos', href: '/treinamentos', icon: GraduationCap, adminOnly: false },
  { label: 'Invest. Pessoais', href: '/investimentos-pessoais', icon: Briefcase, adminOnly: false },
  { label: 'Usuários', href: '/admin/usuarios', icon: Users, adminOnly: true },
]

const roleLabels: Record<string, string> = { admin: 'Administrador', editor: 'Editor', leitor: 'Leitor' }

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { role, isAdmin } = useUserRole()
  const [userName, setUserName] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [userInitial, setUserInitial] = useState('U')

  const supabase = createClient()

  useEffect(() => {
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserEmail(user.email || null)
      const { data: invited } = await supabase.from('invited_users').select('name').eq('email', user.email).single()
      const name = invited?.name || user.user_metadata?.name || null
      if (name) { setUserName(name); setUserInitial(name.charAt(0).toUpperCase()); }
      else if (user.email) { setUserName(user.email); setUserInitial(user.email.charAt(0).toUpperCase()); }
    }
    loadUser()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const nav = baseNav.filter(item => !item.adminOnly || isAdmin)

  return (
    <aside className="fixed left-0 top-0 h-screen w-[260px] flex flex-col" style={{ backgroundColor: '#033244' }}>
      <div className="p-6">
        <h1 className="text-xl font-bold">
          <span className="text-white">Legal </span>
          <span style={{ color: '#D2BD80' }}>Noon</span>
        </h1>
        <p className="text-xs mt-1" style={{ color: '#B2C7D6' }}>Noon Capital Partners</p>
      </div>
      <div className="mx-5 mb-2" style={{ height: '1px', backgroundColor: '#D2BD80', opacity: 0.3 }} />
      <div className="px-3 mb-2">
        <button onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }))}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm transition-colors" style={{ color: '#B2C7D6' }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#B2C7D6'; }}>
          <Search className="w-4 h-4" />
          <span>Buscar</span>
          <kbd className="ml-auto text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: '#B2C7D6' }}>⌘K</kbd>
        </button>
      </div>
      <nav className="flex-1 px-3">
        {nav.map(item => {
          const active = pathname === item.href
          return (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 text-sm transition-colors ${active ? 'font-semibold' : 'font-medium'}`}
              style={active ? { backgroundColor: '#025382', borderLeft: '3px solid #D2BD80' } : {}}>
              <item.icon className="w-5 h-5" style={{ color: active ? '#D2BD80' : '#B2C7D6' }} />
              <span style={{ color: active ? '#FFFFFF' : '#B2C7D6' }}>{item.label}</span>
            </Link>
          )
        })}
      </nav>
      <div className="p-4" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold" style={{ backgroundColor: '#025382', color: '#FFFFFF' }}>{userInitial}</div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-white truncate">{userName || 'Carregando...'}</p>
            <p className="text-xs truncate" style={{ color: '#D2BD80', opacity: 0.7 }}>{roleLabels[role] || role}</p>
          </div>
        </div>
        <button onClick={handleLogout} className="flex items-center gap-2 text-sm w-full px-1 py-1.5 rounded transition-colors"
          style={{ color: '#B2C7D6' }}
          onMouseEnter={(e) => e.currentTarget.style.color = '#D2BD80'}
          onMouseLeave={(e) => e.currentTarget.style.color = '#B2C7D6'}>
          <LogOut className="w-4 h-4" />Sair
        </button>
      </div>
    </aside>
  )
}
