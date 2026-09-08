import { MarketingHeader } from "./marketing-header";
import { MarketingFooter } from "./marketing-footer";

/** Light chrome (header + footer) for the marketing sub-pages. The landing renders its own dark chrome. */
export function MarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <MarketingHeader />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
