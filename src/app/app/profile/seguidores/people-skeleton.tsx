import { Bone, SkeletonMasthead, SkeletonScreen } from "@/components/ui/skeleton";

/** Seguidores / Seguindo while they load: the back link, the masthead, a section head and a few people. */
export function PeopleListSkeleton({ title, label }: { title: string; label: string }) {
  return (
    <SkeletonScreen label={label} className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex min-h-11 items-center font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-muted">‹ Voltar</div>
      <div className="mt-2">
        <SkeletonMasthead kicker="Perfil" title={title} lead={false} />
      </div>
      <div className="mt-8 flex items-center gap-4">
        <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">{title}</span>
        <span className="h-px flex-1 bg-border" />
      </div>
      <div className="mt-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3 border-b border-border py-3">
            <Bone className="size-10 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1">
              <Bone className={i % 2 === 0 ? "h-3.5 w-2/5" : "h-3.5 w-1/3"} />
              <Bone className="mt-2 h-3 w-24" />
            </div>
            <Bone className="h-9 w-24 shrink-0" />
          </div>
        ))}
      </div>
    </SkeletonScreen>
  );
}
