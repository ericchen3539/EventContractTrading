/**
 * POST /api/me/change-password: change password for Credentials users.
 * Requires currentPassword and newPassword. Only users with password (Credentials) can change.
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { hash, compare } from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSafeErrorMessage } from "@/lib/api-utils";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { currentPassword, newPassword } = body as {
      currentPassword?: string;
      newPassword?: string;
    };

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "当前密码和新密码均为必填" },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: "新密码至少 8 位" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { password: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!user.password) {
      return NextResponse.json(
        { error: "Google 登录用户无法修改密码" },
        { status: 400 }
      );
    }

    const ok = await compare(currentPassword, user.password);
    if (!ok) {
      return NextResponse.json(
        { error: "当前密码错误" },
        { status: 400 }
      );
    }

    const hashedPassword = await hash(newPassword, 12);
    await prisma.user.update({
      where: { id: session.user.id },
      data: { password: hashedPassword },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[me/change-password]", err);
    const message = getSafeErrorMessage(err, "修改密码失败");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
