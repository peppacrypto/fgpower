import { Bone, BoneLines, SkeletonMasthead, SkeletonScreen } from "@/components/ui/skeleton";

/**
 * The moderation queue while it loads (from Settings → "Painel admin" or the
 * admin header): the masthead, both tabs (neither lit: this file can't tell
 * which one is being opened) and a couple of report cards.
 */
export default function AdminReportsLoading() {
  return (
    <SkeletonScreen label="as denúncias" className="max-w-3xl">
      <SkeletonMasthead kicker="Admin" title="Denúncias" />
      <div className="mt-6 flex gap-1 border-b border-border">
        <span className="inline-flex min-h-11 items-center px-3 text-sm text-muted">Abertas</span>
        <span className="inline-flex min-h-11 items-center px-3 text-sm text-muted">Resolvidas</span>
      </div>
      <div className="mt-6 flex flex-col gap-4">
        {[0, 1].map((i) => (
          <div key={i} className="reg-frame p-4">
            <div className="flex items-center justify-between gap-2">
              <Bone className="h-5 w-28" />
              <Bone className="h-3 w-12" />
            </div>
            <BoneLines lines={2} className="mt-3" />
            <div className="mt-3 border border-border bg-surface-2 p-3">
              <Bone className="h-3 w-24" />
              <Bone className="mt-2 h-4 w-1/2" />
            </div>
            <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-3">
              <Bone className="h-9 w-32" />
              <Bone className="h-9 w-24" />
              <Bone className="h-9 w-28" />
            </div>
          </div>
        ))}
      </div>
    </SkeletonScreen>
  );
}
