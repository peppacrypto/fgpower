import { notFound } from "next/navigation";

// Unmatched URLs would otherwise fall through to the root 404 (public chrome,
// no app nav). Catching them here renders app/app/not-found.tsx inside the app
// layout instead. Real routes always win over a catch-all segment.
export default function MissingAppPage() {
  notFound();
}
