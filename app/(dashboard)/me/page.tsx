/**
 * Me index: redirects to user events page.
 */
import { redirect } from "next/navigation";

export default function MePage() {
  redirect("/me/events");
}
