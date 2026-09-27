import { Bone, SkeletonScreen } from "@/components/ui/skeleton";

/** Profile: avatar and name, the shortcuts and the three counts. */
export default function ProfileLoading() {
  return (
    <SkeletonScreen label="o seu perfil" className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex items-center gap-4">
        <Bone className="size-16 shrink-0 rounded-full" />
        <Bone className="h-6 flex-1" />
        <Bone className="size-11 shrink-0" />
        <Bone className="size-11 shrink-0" />
      </div>
      <div className="mt-4 flex gap-2">
        <Bone className="h-6 w-24" />
        <Bone className="h-6 w-20" />
      </div>
      <div className="mt-6 grid grid-cols-2 gap-2">
        {[0, 1, 2, 3].map((i) => (
          <Bone key={i} className="h-11" />
        ))}
      </div>
      <div className="mt-6 grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="reg-frame flex flex-col items-center p-4">
            <Bone className="h-7 w-8" />
            <Bone className="mt-2 h-3.5 w-16" />
          </div>
        ))}
      </div>
    </SkeletonScreen>
  );
}
