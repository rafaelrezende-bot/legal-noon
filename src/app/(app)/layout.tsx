"use client"

import { Suspense, lazy } from "react"
import { Sidebar } from "@/components/sidebar"
import { ChatPanel } from "@/components/chat-panel"

const GlobalSearch = lazy(() => import("@/components/global-search").then(m => ({ default: m.GlobalSearch })))

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Sidebar />
      <main className="ml-[260px] min-h-screen">
        {children}
      </main>
      <ChatPanel />
      <Suspense fallback={null}>
        <GlobalSearch />
      </Suspense>
    </>
  )
}
