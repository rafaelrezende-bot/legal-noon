export interface Category {
  id: string
  name: string
  slug: string
  color: string
}

export interface Obligation {
  id: string
  category_id: string
  title: string
  description: string | null
  legal_basis: string | null
  frequency: 'anual' | 'semestral' | 'trimestral' | 'mensal' | 'continuo' | 'por_evento'
  fixed_month: number | null
  fixed_day: number | null
  is_business_day: boolean
  source_document: string | null
  category?: Category
}

export interface ObligationInstance {
  id: string
  obligation_id: string
  due_date: string
  status: 'pendente' | 'em_andamento' | 'concluida' | 'atrasada'
  completed_at: string | null
  notes: string | null
  obligation?: Obligation
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}
