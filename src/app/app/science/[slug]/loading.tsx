import { Bone, BoneLines, SkeletonScreen } from "@/components/ui/skeleton";

/** A principle: the kicker back to the library, the display title, the summary and the text. */
export function ScienceArticleSkeleton() {
  return (
    <SkeletonScreen label="o princípio" className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <Bone className="h-3 w-44" />
      <Bone className="mt-3 h-8 w-11/12 sm:h-9" />
      <Bone className="mt-2 h-8 w-1/2 sm:h-9" />
      <BoneLines lines={2} className="mt-4" lineClassName="h-4" />
      <div className="mt-8 flex flex-col gap-6">
        <BoneLines lines={5} />
        <div>
          <Bone className="h-5 w-2/5" />
          <BoneLines lines={4} className="mt-3" />
        </div>
        <BoneLines lines={3} />
      </div>
    </SkeletonScreen>
  );
}

export default ScienceArticleSkeleton;
