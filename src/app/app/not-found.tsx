import { NotFoundBottomNav } from "@/components/nav/bottom-nav";
import { NotFoundPanel } from "@/components/ui/not-found-panel";

// notFound() anywhere under /app (a stale workout link, a deleted program…)
// renders here, inside the app layout, so the nav stays on screen. No
// `metadata` export: Next never applies it at this level (every /app 404 is a
// page-level notFound(), even the [...missing] catch-all), so the title comes
// from the panel's own <title>.
export default function AppNotFound() {
  return (
    <>
      <NotFoundPanel programsHref="/app/programs" />
      <NotFoundBottomNav />
    </>
  );
}
