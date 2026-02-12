/**
 * My page: displays user's followed events.
 * Events loaded client-side via GET /api/me/followed-events.
 */
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { MePageContent } from "@/components/me/MePageContent";

export default async function MePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  return <MePageContent />;
}
