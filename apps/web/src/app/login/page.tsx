import { Suspense } from "react";
import LoginForm from "./LoginForm";

/** /login — server shell; the Suspense boundary lets the client form use useSearchParams. */
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
