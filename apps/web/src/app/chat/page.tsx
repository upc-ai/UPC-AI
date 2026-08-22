import { Suspense } from "react";
import ChatHome from "./ChatHome";

/** /chat — server shell; the Suspense boundary lets the client view use useSearchParams. */
export default function ChatPage() {
  return (
    <Suspense fallback={null}>
      <ChatHome />
    </Suspense>
  );
}
