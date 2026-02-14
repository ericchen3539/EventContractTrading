import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

/**
 * Root page: redirects to /me/markets when logged in, /login otherwise.
 */
export default async function HomePage() {
  const session = await getServerSession(authOptions);
  if (session) redirect("/me/markets");
  redirect("/login");
}
