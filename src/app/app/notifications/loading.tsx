import { Bone, SkeletonMasthead, SkeletonScreen } from "@/components/ui/skeleton";

/** Notifications: the masthead, a bucket head and a few lines (a face, a sentence, a time). */
export default function NotificationsLoading() {
  return (
    <SkeletonScreen label="as notificações" className="mx-auto max-w-xl px-4 py-6 sm:px-6 sm:py-8">
      <SkeletonMasthead kicker="Sua atividade" title="Notificações" lead={false} />
      <div className="mt-8 flex items-center gap-4">
        <Bone className="h-3 w-16" />
        <span className="h-px flex-1 bg-border" />
      </div>
      <div className="mt-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3 border-b border-border px-1 py-3.5">
            <Bone className="size-9 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1">
              <Bone className={i % 2 === 0 ? "h-3.5 w-4/5" : "h-3.5 w-3/5"} />
              <Bone className="mt-2 h-3 w-14" />
            </div>
          </div>
        ))}
      </div>
    </SkeletonScreen>
  );
}
