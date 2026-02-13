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

  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM ?? "noreply@resend.dev",
    to,
    subject: "验证您的邮箱",
    html: buildVerificationEmailHtml(verifyUrl),
  });

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
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

  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM ?? "noreply@resend.dev",
    to,
    subject: "重置密码",
    html: buildPasswordResetEmailHtml(resetUrl),
  });

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
