import { Bone, SkeletonScreen } from "@/components/ui/skeleton";

/** New program: the back link, the title and the one-field form card. */
export function NewProgramSkeleton() {
  return (
    <SkeletonScreen label="o formulário" className="mx-auto max-w-md px-4 pb-10 pt-3 sm:px-6 sm:py-10">
      <Bone className="my-4 h-3 w-24" />
      <div className="text-display mt-4 text-[1.75rem] font-semibold leading-tight sm:text-[2rem]">Criar programa</div>
      <Bone className="mt-2 h-3.5 w-4/5" />
      <div className="card mt-6 p-5">
        <Bone className="h-3.5 w-28" />
        <Bone className="mt-2 h-11 w-full rounded-[var(--radius-md)]" />
        <Bone className="mt-5 h-12 w-full rounded-[var(--radius-md)]" />
      </div>
    </SkeletonScreen>
  );
}

export default NewProgramSkeleton;
