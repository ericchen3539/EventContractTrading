/**
 * POST /api/auth/reset-password: set new password using reset token.
 */
import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/db";
import { getSafeErrorMessage } from "@/lib/api-utils";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token, newPassword } = body as {
      token?: string;
      newPassword?: string;
    };

    if (!token || typeof token !== "string") {
      return NextResponse.json(
        { error: "无效的重置链接" },
        { status: 400 }
      );
    }

    if (!newPassword || newPassword.length < 8) {
      return NextResponse.json(
        { error: "新密码至少 8 位" },
        { status: 400 }
      );
    }

    const record = await prisma.verificationToken.findUnique({
      where: { token },
    });

    if (
      !record ||
      record.type !== "password_reset" ||
      record.expires < new Date()
    ) {
      return NextResponse.json(
        { error: "链接无效或已过期" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findFirst({
      where: { email: record.identifier },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "用户不存在" },
        { status: 400 }
      );
    }

    const hashedPassword = await hash(newPassword, 12);
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword },
      }),
      prisma.verificationToken.delete({
        where: { id: record.id },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[auth/reset-password]", err);
    const message = getSafeErrorMessage(err, "重置失败");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
