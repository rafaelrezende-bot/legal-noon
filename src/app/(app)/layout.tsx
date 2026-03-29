import { Sidebar } from "@/components/sidebar"
import { ChatPanel } from "@/components/chat-panel"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Sidebar />
      <main className="ml-[260px] min-h-screen">
        {children}
      </main>
      <ChatPanel />
    </>
  )
}
