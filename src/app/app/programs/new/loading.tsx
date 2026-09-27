import { Bone, SkeletonScreen } from "@/components/ui/skeleton";

/** New program: the one-field form. */
export function NewProgramSkeleton() {
  return (
    <SkeletonScreen label="o formulário" className="mx-auto max-w-md px-4 py-10 sm:px-6">
      <Bone className="mb-8 h-7 w-32" />
      <Bone className="h-6 w-40" />
      <Bone className="mt-2 h-3.5 w-4/5" />
      <Bone className="mt-6 h-3.5 w-12" />
      <Bone className="mt-2 h-11 w-full" />
      <Bone className="mt-4 h-11 w-full" />
    </SkeletonScreen>
  );
}

export default NewProgramSkeleton;
