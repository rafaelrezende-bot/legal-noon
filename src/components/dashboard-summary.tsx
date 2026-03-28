"use client"
import { Card } from '@/components/ui/card'
import { AlertTriangle, Clock, CheckCircle2, CalendarDays } from 'lucide-react'

interface Props {
  totalMonth: number
  overdue: number
  next7Days: number
  completedMonth: number
}

export function DashboardSummary({ totalMonth, overdue, next7Days, completedMonth }: Props) {
  const cards = [
    { label: 'Obrigações do mês', value: totalMonth, icon: CalendarDays, color: '#0F334D', bg: '#EBF5FA' },
    { label: 'Atrasadas', value: overdue, icon: AlertTriangle, color: '#DC2626', bg: '#FEF2F2' },
    { label: 'Próximos 7 dias', value: next7Days, icon: Clock, color: '#F59E0B', bg: '#FFFBEB' },
    { label: 'Concluídas no mês', value: completedMonth, icon: CheckCircle2, color: '#16A34A', bg: '#F0FDF4' },
  ]
  return (
    <div className="grid grid-cols-4 gap-4">
      {cards.map(c => (
        <Card key={c.label} className="p-5 bg-white rounded-xl shadow-sm border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: c.bg }}>
              <c.icon className="w-5 h-5" style={{ color: c.color }} />
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: c.color }}>{c.value}</p>
              <p className="text-xs text-gray-500">{c.label}</p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}
