/**
 * Email sending via Resend.
 * Used for verification and password reset links.
 * When RESEND_API_KEY is not set, send functions return ok: false (e.g. local dev).
 */
import { Resend } from "resend";
import {
  buildVerificationEmailHtml,
  buildPasswordResetEmailHtml,
} from "./email-templates";

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

/**
 * Send email verification link to the user.
 */
export async function sendVerificationEmail(
  to: string,
  token: string
): Promise<{ ok: boolean; error?: string }> {
  const resend = getResend();
  if (!resend) {
    return { ok: false, error: "RESEND_API_KEY not configured" };
  }
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const verifyUrl = `${baseUrl}/verify-email?token=${encodeURIComponent(token)}`;
  const from = process.env.EMAIL_FROM ?? "onboarding@resend.dev";

  try {
    const { data, error } = await resend.emails.send({
      from,
      to,
      subject: "验证您的邮箱",
      html: buildVerificationEmailHtml(verifyUrl),
    });

    if (error) {
      console.error("[email] verification failed:", error.message, "to", to);
      return { ok: false, error: error.message };
    }
    console.error("[email] verification sent id=" + (data?.id ?? "?") + " to=" + to);
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[email] verification threw:", msg);
    return { ok: false, error: msg };
  }
}

/**
 * Send password reset link to the user.
 */
export async function sendPasswordResetEmail(
  to: string,
  token: string
): Promise<{ ok: boolean; error?: string }> {
  const resend = getResend();
  if (!resend) {
    return { ok: false, error: "RESEND_API_KEY not configured" };
  }
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`;

  const from = process.env.EMAIL_FROM ?? "onboarding@resend.dev";
  try {
    const { data, error } = await resend.emails.send({
      from,
      to,
      subject: "重置密码",
      html: buildPasswordResetEmailHtml(resetUrl),
    });
    if (error) {
      console.error("[email] password reset failed:", error.message, "to", to);
      return { ok: false, error: error.message };
    }
    console.error("[email] password reset sent id=" + (data?.id ?? "?") + " to=" + to);
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[email] password reset threw:", msg);
    return { ok: false, error: msg };
  }
}
