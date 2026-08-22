"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { WelcomeChat } from "@/components/chat/ChatView";
import { setFirstMessageAttachments } from "@/lib/first-message";

/** /chat client view — new conversation welcome state. */
export default function ChatHome() {
  const router = useRouter();
  const params = useSearchParams();
  const pending = params.get("q");

  // Auto-send a pending question (e.g., starter clicked before session existed)
  useEffect(() => {
    if (!pending) return;
    sessionStorage.setItem("upcai:pending", pending);
    router.replace("/chat");
  }, [pending, router]);

  return (
    <WelcomeChat
      onSessionCreated={(sessionId, firstMessage, _studyMode, _language, attachments) => {
        // Store even when empty — an attachments-only first message still needs
        // the pending marker so SessionChat fires it (content "" is valid there).
        sessionStorage.setItem("upcai:pending", firstMessage);
        setFirstMessageAttachments(attachments);
        router.push(`/chat/${sessionId}`);
      }}
    />
  );
}
