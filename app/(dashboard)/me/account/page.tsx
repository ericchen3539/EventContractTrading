/**
 * User account page: profile info, email verification status, change password.
 */
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AccountPageContent } from "@/components/me/AccountPageContent";

export default async function AccountPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
        用户账号
      </h1>
      <AccountPageContent />
    </div>
  );
}
