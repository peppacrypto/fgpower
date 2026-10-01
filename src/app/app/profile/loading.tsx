import { Bone, SkeletonScreen } from "@/components/ui/skeleton";
import { NestedSkeleton } from "@/components/ui/skeleton-client";
import { PeopleListSkeleton } from "./seguidores/people-skeleton";

/** Profile; also the fallback for Seguidores / Seguindo until their own arrives. */
export default function ProfileLoading() {
  return (
    <NestedSkeleton
      own={<ProfileSkeleton />}
      routes={[
        ["/app/profile/seguidores", <PeopleListSkeleton key="seguidores" title="Seguidores" label="os seus seguidores" />],
        ["/app/profile/seguindo", <PeopleListSkeleton key="seguindo" title="Seguindo" label="quem você segue" />],
      ]}
    />
  );
}

/** Profile: avatar and name, the shortcuts and the three counts. */
function ProfileSkeleton() {
  return (
    <SkeletonScreen label="o seu perfil" className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex items-center gap-4">
        <Bone className="size-16 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1">
          <span className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-muted">Perfil</span>
          <Bone className="mt-1 h-7 w-3/4" />
        </div>
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
