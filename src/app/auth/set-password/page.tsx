"use client"

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'

export default function SetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.')
      return
    }
    if (password !== confirm) {
      setError('As senhas não coincidem.')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setError('Erro ao definir senha. Tente novamente.')
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
          <p className="text-sm text-gray-500 mt-2">Crie sua senha para acessar</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Nova senha</label>
            <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" required />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Confirmar senha</label>
            <Input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repita a senha" required />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button type="submit" className="w-full" style={{ backgroundColor: '#025382' }} disabled={loading}>
            {loading ? 'Salvando...' : 'Criar senha e entrar'}
          </Button>
        </form>
      </Card>
    </div>
  )
}
