import { Bone, BoneLines, SkeletonScreen } from "@/components/ui/skeleton";

/** A principle: the way back, the title, the summary, the practical upshot and the text. */
export function ScienceArticleSkeleton() {
  return (
    <SkeletonScreen label="o princípio" className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="-mt-2 flex h-11 items-center">
        <Bone className="h-3.5 w-40" />
      </div>
      <Bone className="mt-3 h-8 w-11/12 sm:h-10" />
      <Bone className="mt-2 h-8 w-1/2 sm:h-10" />
      <BoneLines lines={2} className="mt-4" lineClassName="h-4" />
      <div className="mt-6 rounded-[var(--radius-lg)] bg-accent-soft p-4 sm:p-5">
        <Bone className="h-3.5 w-32" />
        <BoneLines lines={3} className="mt-3" lineClassName="h-4" />
      </div>
      <div className="mt-10 flex flex-col gap-6">
        <BoneLines lines={5} lineClassName="h-4" />
        <BoneLines lines={4} lineClassName="h-4" />
      </div>
    </SkeletonScreen>
  );
}

export default ScienceArticleSkeleton;
