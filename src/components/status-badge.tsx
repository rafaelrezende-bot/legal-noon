import { Badge } from '@/components/ui/badge'

const statusConfig: Record<string, { label: string; className: string }> = {
  pendente: { label: 'Pendente', className: 'bg-gray-100 text-gray-600 hover:bg-gray-100' },
  em_andamento: { label: 'Em andamento', className: 'bg-blue-50 text-blue-600 hover:bg-blue-50' },
  concluida: { label: 'Concluida', className: 'bg-green-50 text-green-600 hover:bg-green-50' },
  atrasada: { label: 'Atrasada', className: 'bg-red-50 text-red-600 hover:bg-red-50' },
}

interface Props {
  status: string
  size?: 'sm' | 'default'
}

export function StatusBadge({ status, size = 'default' }: Props) {
  const config = statusConfig[status] || statusConfig.pendente
  return (
    <Badge variant="secondary" className={`${config.className} ${size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-2.5 py-1'} font-medium rounded-full`}>
      {config.label}
    </Badge>
  )
}
