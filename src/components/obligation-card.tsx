"use client"
import { Card } from '@/components/ui/card'
import { StatusBadge } from './status-badge'
import { Calendar } from 'lucide-react'
import type { ObligationInstance, Category } from '@/lib/types'

const frequencyLabels: Record<string, string> = {
  anual: 'Anual',
  semestral: 'Semestral',
  trimestral: 'Trimestral',
  mensal: 'Mensal',
  continuo: 'Continuo',
  por_evento: 'Por evento',
}

interface Props {
  instance: ObligationInstance & { obligation: { title: string; description: string | null; frequency: string; category: Category } }
  onClick?: () => void
}

export function ObligationCard({ instance, onClick }: Props) {
  const { obligation } = instance
  const category = obligation.category
  const dueDate = new Date(instance.due_date + 'T12:00:00')
  const today = new Date()
  today.setHours(0,0,0,0)
  const effectiveStatus = instance.status !== 'concluida' && dueDate < today ? 'atrasada' : instance.status

  return (
    <Card className="p-4 cursor-pointer hover:shadow-md transition-shadow border-l-4" style={{ borderLeftColor: category.color }} onClick={onClick}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: category.color + '15', color: category.color }}>
          {category.name}
        </span>
        <StatusBadge status={effectiveStatus} size="sm" />
      </div>
      <h3 className="font-semibold text-gray-900 text-base mb-1">{obligation.title}</h3>
      {obligation.description && (
        <p className="text-sm text-gray-500 line-clamp-2 mb-3">{obligation.description}</p>
      )}
      <div className="flex items-center gap-2 text-xs text-gray-400">
        <Calendar className="w-3.5 h-3.5" />
        <span>{dueDate.toLocaleDateString('pt-BR')}</span>
        <span>·</span>
        <span>{frequencyLabels[obligation.frequency] || obligation.frequency}</span>
      </div>
    </Card>
  )
}
