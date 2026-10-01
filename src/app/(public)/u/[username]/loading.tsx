import { Bone, BoneLines, SkeletonScreen } from "@/components/ui/skeleton";

/** A profile while it loads: the avatar and name, the counts, then workout cards. */
export default function ProfileLoading() {
  return (
    <SkeletonScreen label="o perfil" className="mx-auto w-full max-w-xl px-4 py-6 sm:px-6 sm:py-8">
      <Bone className="-mt-2 mb-2 h-11 w-20" />
      <div className="flex items-center gap-4">
        <Bone className="size-[72px] shrink-0 rounded-full" />
        <div className="min-w-0 flex-1">
          <Bone className="h-6 w-40" />
          <Bone className="mt-2 h-3.5 w-24" />
        </div>
      </div>
      <Bone className="mt-4 h-3.5 w-48" />
      <Bone className="mt-4 h-9 w-28" />
      <div className="mt-8 flex items-center gap-4">
        <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">Atividade</span>
        <span className="h-px flex-1 bg-border" />
      </div>
      <div className="mt-4 flex flex-col gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="reg-frame p-4">
            <div className="flex items-center gap-2.5">
              <Bone className="size-9 shrink-0 rounded-full" />
              <Bone className="h-4 w-32" />
            </div>
            <div className="mt-3 border-l-2 border-l-border bg-surface-2 p-3.5">
              <BoneLines lines={2} />
            </div>
            <Bone className="mt-3 h-11 w-20" />
          </div>
        ))}
      </div>
    </SkeletonScreen>
  );
}
