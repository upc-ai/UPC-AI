import { Suspense } from "react";
import { VerifyForm } from "./VerifyForm";

/** /verify — email OTP verification screen (reached right after signup). */
export default function VerifyPage() {
  return (
    <Suspense>
      <VerifyForm />
    </Suspense>
  );
}
