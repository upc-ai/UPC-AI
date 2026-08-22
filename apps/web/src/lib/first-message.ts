import type { PendingAttachment } from "@/components/chat/Composer";

/**
 * First-message attachments hand-off. The welcome screen creates the session,
 * then navigates to /chat/[id] — a client-side route change, so this module
 * variable survives it (sessionStorage would risk quota errors on big files).
 * SessionChat consumes it right after firing the pending text.
 */
let firstMessageAttachments: PendingAttachment[] = [];

export function setFirstMessageAttachments(attachments: PendingAttachment[]) {
  firstMessageAttachments = attachments;
}

export function consumeFirstMessageAttachments(): PendingAttachment[] {
  const atts = firstMessageAttachments;
  firstMessageAttachments = [];
  return atts;
}
