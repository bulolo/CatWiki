"use client"

import dynamic from "next/dynamic"

const ChatSessionsPage = dynamic(
  () => import("@/ee/components/ChatSessionsPage")
    .then(mod => ({ default: mod.ChatSessionsPage }))
    .catch(() => ({ default: () => null })),
  { ssr: false }
)

export default function ChatPage() {
  return <ChatSessionsPage />
}
