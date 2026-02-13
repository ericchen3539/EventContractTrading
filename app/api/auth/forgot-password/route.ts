/**
 * POST /api/auth/forgot-password: send password reset email.
 * Rate limited. Always returns success to prevent email enumeration.
 */
import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendPasswordResetEmail } from "@/lib/email";
import { getSafeErrorMessage } from "@/lib/api-utils";

const TOKEN_EXPIRY_HOURS = 1;

export async function POST(request: Request) {
  if (!checkRateLimit(request, "forgot-password")) {
    return NextResponse.json(
      { error: "请求过于频繁，请稍后再试" },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const { email } = body as { email?: string };

    const trimEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    if (!trimEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimEmail)) {
      return NextResponse.json(
        { error: "请输入有效的邮箱地址" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findFirst({
      where: { email: trimEmail },
      select: { id: true },
    });

    if (user) {
      const token = crypto.randomBytes(32).toString("hex");
      const expires = new Date();
      expires.setHours(expires.getHours() + TOKEN_EXPIRY_HOURS);

      await prisma.verificationToken.create({
        data: {
          identifier: trimEmail,
          token,
          type: "password_reset",
          expires,
        },
      });

      const result = await sendPasswordResetEmail(trimEmail, token);
      if (!result.ok) {
        console.error("[forgot-password] send failed:", result.error);
      }
    }

    return NextResponse.json({
      success: true,
      message: "若该邮箱已注册，将收到重置邮件，请查收",
    });
  } catch (err) {
    console.error("[auth/forgot-password]", err);
    const message = getSafeErrorMessage(err, "操作失败");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
