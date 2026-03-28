"use client"

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Email ou senha incorretos.')
      setLoading(false)
      return
    }

    router.push('/')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-sm p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold"><span style={{ color: '#033244' }}>Legal </span><span style={{ color: '#D2BD80' }}>Noon</span></h1>
          <p className="text-xs text-gray-400 mt-1">Noon Capital Partners</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Email</label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" required />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Senha</label>
            <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button type="submit" className="w-full" style={{ backgroundColor: '#025382' }} disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>
        <div className="mt-4 text-center">
          <Link href="/auth/forgot-password" className="text-sm hover:underline" style={{ color: '#008FD0' }}>Esqueci minha senha</Link>
        </div>
      </Card>
    </div>
  )
}
