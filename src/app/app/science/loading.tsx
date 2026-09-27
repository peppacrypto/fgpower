import { PageSkeleton } from "@/components/ui/skeleton";
import { NestedSkeleton } from "@/components/ui/skeleton-client";
import { ScienceArticleSkeleton } from "./[slug]/loading";

/** The science library; also the fallback for each principle until the principle's own arrives. */
export default function ScienceLoading() {
  return (
    <NestedSkeleton
      own={<PageSkeleton label="a biblioteca de ciência" />}
      routes={[["/app/science/*", <ScienceArticleSkeleton key="principle" />]]}
    />
  );
}
