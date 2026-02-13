/**
 * Auth layout: centers login/register forms. Redirects logged-in users to /sites.
 */
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (session) redirect("/me/events");
  return (
    <div className="flex min-h-screen items-center justify-center bg-blue-50/40 px-4 dark:bg-slate-950">
      {children}
    </div>
  );
}
