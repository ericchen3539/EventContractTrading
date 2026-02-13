/**
 * Registration API: creates a new user with email/password (Credentials provider).
 * Bcrypt hashes the password before storing.
 */
import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/db";
import { getSafeErrorMessage } from "@/lib/api-utils";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  if (!checkRateLimit(request, "register")) {
    return NextResponse.json(
      { error: "Too many registration attempts. Please try again later." },
      { status: 429 }
    );
  }
  try {
    const body = await request.json();
    const { email, password, name } = body as {
      email?: string;
      password?: string;
      name?: string;
    };

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const trimEmail = String(email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimEmail)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findFirst({
      where: { email: trimEmail },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 409 }
      );
    }

    const hashedPassword = await hash(password, 12);
    await prisma.user.create({
      data: {
        email: trimEmail,
        name: (name ?? "").trim() || null,
        password: hashedPassword,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[auth/register]", err);
    const message = getSafeErrorMessage(err, "Registration failed");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
