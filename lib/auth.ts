/**
 * NextAuth configuration: Prisma adapter, Google OAuth, and Credentials (email/password).
 * Session uses JWT strategy (Credentials provider requires JWT; DB sessions not supported).
 * Prisma adapter still used for User/Account (Google OAuth).
 */
import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/db";

const isProduction = process.env.NODE_ENV === "production";
if (isProduction && !process.env.NEXTAUTH_SECRET) {
  throw new Error(
    "NEXTAUTH_SECRET is required in production. Add it in Vercel Project Settings → Environment Variables."
  );
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const user = await prisma.user.findFirst({
          where: { email: credentials.email },
        });
        if (!user?.password) return null;
        const ok = await compare(credentials.password, user.password);
        if (!ok) return null;
        return {
          id: user.id,
          email: user.email ?? undefined,
          name: user.name ?? undefined,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    redirect: async ({ url, baseUrl }) => {
      if (url.startsWith("/")) {
        const target = url === "/" ? "/me" : url;
        return `${baseUrl}${target}`;
      }
      if (new URL(url).origin === baseUrl) return url;
      return `${baseUrl}/me`;
    },
    session: async ({ session, token }) => {
      if (session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
};
