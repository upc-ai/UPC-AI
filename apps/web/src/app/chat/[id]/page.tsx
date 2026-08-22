"use client";

import { useParams } from "next/navigation";
import { SessionChat } from "@/components/chat/ChatView";

/** /chat/[sessionId] — an active conversation. */
export default function SessionPage() {
  const params = useParams<{ id: string }>();
  return <SessionChat sessionId={params.id} />;
}
