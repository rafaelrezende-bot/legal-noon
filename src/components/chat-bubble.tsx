import type { ChatMessage } from '@/lib/types'

interface Props {
  message: ChatMessage
}

export function ChatBubble({ message }: Props) {
  const isUser = message.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`max-w-[75%] px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
        isUser
          ? 'bg-[#1E7FA8] text-white rounded-2xl rounded-tr-md'
          : 'bg-[#EBF5FA] text-gray-900 rounded-2xl rounded-tl-md'
      }`}>
        {message.content}
        <div className={`text-[10px] mt-1.5 ${isUser ? 'text-white/60' : 'text-gray-400'}`}>
          {new Date(message.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  )
}
