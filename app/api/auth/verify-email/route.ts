/**
 * GET /api/auth/verify-email?token=xxx: verify email and set User.emailVerified.
 * Redirects to /login?verified=1 on success, or /verify-email?error=1 on failure.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(`${baseUrl}/verify-email?error=missing`);
  }

  const record = await prisma.verificationToken.findUnique({
    where: { token },
  });

  if (
    !record ||
    record.type !== "email_verify" ||
    record.expires < new Date()
  ) {
    return NextResponse.redirect(`${baseUrl}/verify-email?error=invalid`);
  }

  const user = await prisma.user.findFirst({
    where: { email: record.identifier },
    select: { id: true },
  });

  if (!user) {
    return NextResponse.redirect(`${baseUrl}/verify-email?error=invalid`);
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: new Date() },
    }),
    prisma.verificationToken.delete({
      where: { id: record.id },
    }),
  ]);

  return NextResponse.redirect(`${baseUrl}/login?verified=1`);
}
