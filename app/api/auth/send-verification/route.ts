/**
 * POST /api/auth/send-verification: resend verification email for logged-in user.
 * Rate limited. Only for users with unverified email.
 */
import { NextResponse } from "next/server";
import crypto from "crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendVerificationEmail } from "@/lib/email";
import { getSafeErrorMessage } from "@/lib/api-utils";

const VERIFY_TOKEN_EXPIRY_HOURS = 24;

export async function POST(request: Request) {
  if (!checkRateLimit(request, "send-verification")) {
    return NextResponse.json(
      { error: "请求过于频繁，请稍后再试" },
      { status: 429 }
    );
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { email: true, emailVerified: true },
    });

    if (!user?.email) {
      return NextResponse.json(
        { error: "无邮箱地址，无法发送验证邮件" },
        { status: 400 }
      );
    }

    if (user.emailVerified) {
      return NextResponse.json(
        { error: "邮箱已验证" },
        { status: 400 }
      );
    }

    await prisma.verificationToken.deleteMany({
      where: {
        identifier: user.email,
        type: "email_verify",
      },
    });

    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date();
    expires.setHours(expires.getHours() + VERIFY_TOKEN_EXPIRY_HOURS);

    await prisma.verificationToken.create({
      data: {
        identifier: user.email,
        token,
        type: "email_verify",
        expires,
      },
    });

    console.error("[send-verification] calling sendVerificationEmail to", user.email);
    const result = await sendVerificationEmail(user.email, token);
    console.error("[send-verification] result ok=" + result.ok + (result.error ? " error=" + result.error : ""));
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error ?? "发送失败" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[auth/send-verification]", err);
    const message = getSafeErrorMessage(err, "发送失败");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
