"use client"

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
    })

    setSent(true)
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-sm p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold"><span style={{ color: '#033244' }}>Legal </span><span style={{ color: '#D2BD80' }}>Noon</span></h1>
          <p className="text-sm text-gray-500 mt-2">Recuperar senha</p>
        </div>
        {sent ? (
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-4">Enviamos um link de recuperação para <strong>{email}</strong>.</p>
            <Link href="/login" className="text-sm font-medium" style={{ color: '#008FD0' }}>Voltar ao login</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Email</label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" required />
            </div>
            <Button type="submit" className="w-full" style={{ backgroundColor: '#025382' }} disabled={loading}>
              {loading ? 'Enviando...' : 'Enviar link de recuperação'}
            </Button>
            <div className="text-center">
              <Link href="/login" className="text-sm hover:underline" style={{ color: '#008FD0' }}>Voltar ao login</Link>
            </div>
          </form>
        )}
      </Card>
    </div>
  )
}
