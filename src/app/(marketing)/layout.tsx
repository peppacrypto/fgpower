export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  // Header/footer are provided per-page so the landing can render a committed
  // dark athletic experience while sub-pages (programs/exercises/science/
  // privacy/terms) keep the clean light chrome.
  return <>{children}</>;
}
