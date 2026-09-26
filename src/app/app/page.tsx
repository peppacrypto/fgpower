import { redirect } from "next/navigation";

/** A bare /app (old bookmarks, the PWA start URL typed by hand) opens Today. */
export default function AppIndex() {
  redirect("/app/today");
}
