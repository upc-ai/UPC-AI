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
  // Hosted from the deployed site — email clients can't render local/SVG assets
  const logoUrl = "https://www.upcai.app/og-image.png";
  const html = `<!doctype html><html><body style="margin:0;background:#111110;font-family:Arial,Helvetica,sans-serif;padding:32px 16px">
  <div style="max-width:480px;margin:0 auto;background:#1c1c1a;border-radius:16px;padding:0;border:1px solid #2e2c28;overflow:hidden">
    <div style="background:#171717;padding:24px 32px;text-align:center;border-bottom:1px solid #2e2c28">
      <img src="${logoUrl}" alt="UPC AI" width="120" style="display:block;margin:0 auto 8px;border-radius:8px" />
      <div style="font-size:12px;letter-spacing:3px;color:#a8a49a;text-transform:uppercase;font-weight:700">UPC AI</div>
    </div>
    <div style="padding:32px">
      <h1 style="font-size:22px;color:#f5f4f0;margin:0 0 8px">${headline}</h1>
      <p style="font-size:14px;color:#b5b1a6;line-height:1.6">Use this code to continue. It expires in ${minutes} minutes and works once.</p>
      <div style="font-size:36px;letter-spacing:12px;font-weight:700;color:#ffffff;background:#111110;border:1px solid #2e2c28;border-radius:12px;padding:20px;text-align:center;margin:24px 0">${code}</div>
      <p style="font-size:12px;color:#8a877f;line-height:1.6">If you didn't request this, ignore this email — your account is safe. Never share this code with anyone, not even someone claiming to be from the college.</p>
    </div>
    <div style="padding:16px 32px;background:#171717;border-top:1px solid #2e2c28">
      <p style="font-size:11px;color:#6e6a61;margin:0;text-align:center">Udai Pratap College, Varanasi · <a href="https://www.upcai.app" style="color:#a8a49a;text-decoration:none">upcai.app</a></p>
    </div>
  </div></body></html>`;
  const text = `${headline}\n\nYour UPC AI code: ${code}\nExpires in ${minutes} minutes, single use.\nIf you didn't request this, ignore this email.`;
  return { to: "", subject: `${headline} · ${code}`, html, text };
}
