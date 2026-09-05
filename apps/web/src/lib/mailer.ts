/**
 * Transactional mail (OTP codes) — Resend HTTP API, no SDK.
 * MAIL_PROVIDER=console (default): logs server-side, dev-mode pages may show codes.
 * MAIL_PROVIDER=resend: real delivery to user inboxes. Keys/From via env.
 */
import { getEnv } from "@upc/core";

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export async function sendMail(msg: MailMessage): Promise<void> {
  const env = getEnv();
  if (env.MAIL_PROVIDER === "resend" && env.RESEND_API_KEY) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: env.MAIL_FROM, to: msg.to, subject: msg.subject, html: msg.html, text: msg.text }),
    });
    if (!res.ok) throw new Error(`Resend delivery failed: ${res.status} ${await res.text()}`);
    return;
  }
  // Dev fallback — visible only in server logs, never sent to any client
  console.info(`[mail:console] to=${msg.to} subject="${msg.subject}"\n${msg.text}`);
}

/** Branded OTP email body. */
export function otpEmail(code: string, purpose: string, minutes = 10): MailMessage {
  const headline =
    purpose === "password_reset"
      ? "Reset your password"
      : purpose === "email_verify"
        ? "Verify your email"
        : "Your sign-in code";
  const html = `<!doctype html><html><body style="margin:0;background:#f6f5f2;font-family:Arial,Helvetica,sans-serif;padding:32px 16px">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;border:1px solid #e8e6e1">
    <div style="font-size:13px;letter-spacing:2px;color:#8a877f;text-transform:uppercase">UPC AI</div>
    <h1 style="font-size:22px;color:#1a1a18;margin:12px 0 8px">${headline}</h1>
    <p style="font-size:14px;color:#57534a;line-height:1.6">Use this code to continue. It expires in ${minutes} minutes and works once.</p>
    <div style="font-size:34px;letter-spacing:10px;font-weight:700;color:#1a1a18;background:#f6f5f2;border-radius:12px;padding:18px;text-align:center;margin:20px 0">${code}</div>
    <p style="font-size:12px;color:#8a877f;line-height:1.6">If you didn't request this, ignore this email — your account is safe. Never share this code with anyone.</p>
  </div></body></html>`;
  const text = `${headline}\n\nYour UPC AI code: ${code}\nExpires in ${minutes} minutes, single use.\nIf you didn't request this, ignore this email.`;
  return { to: "", subject: `${headline} · ${code}`, html, text };
}
