import { Bone, BoneLines, SkeletonScreen } from "@/components/ui/skeleton";

/** A profile while it loads: the avatar and name, the counts, then workout cards. */
export default function ProfileLoading() {
  return (
    <SkeletonScreen label="o perfil" className="mx-auto w-full max-w-xl px-4 py-6 sm:px-6 sm:py-8">
      <Bone className="-mt-2 mb-2 h-11 w-20" />
      <div className="flex items-center gap-4">
        <Bone className="size-[72px] shrink-0 rounded-full" />
        <div className="min-w-0 flex-1">
          <Bone className="h-8 w-40" />
          <Bone className="mt-2 h-3.5 w-24" />
        </div>
      </div>
      <Bone className="mt-4 h-3.5 w-48" />
      <Bone className="mt-4 h-9 w-28" />
      <div className="mt-8">
        <span className="text-[17px] font-semibold text-muted">Atividade</span>
      </div>
      <div className="mt-4 flex flex-col gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="card p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <Bone className="size-10 shrink-0 rounded-full" />
              <Bone className="h-4 w-32" />
            </div>
            <BoneLines lines={2} className="mt-4" />
            <div className="mt-4 border-t border-border pt-3">
              <Bone className="h-11 w-20" />
            </div>
          </div>
        ))}
      </div>
    </SkeletonScreen>
  );
}
