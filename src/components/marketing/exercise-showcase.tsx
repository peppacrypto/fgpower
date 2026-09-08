import Image from "next/image";
import Link from "next/link";

export interface ShowcaseItem {
  slug: string;
  namePt: string;
  imageUrl: string;
  muscle: string | null;
}

/** A dense, energetic grid of real exercise photography — the honest visual proof that the library is real. */
export function ExerciseShowcase({ items }: { items: ShowcaseItem[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {items.map((item, i) => (
        <Link
          key={item.slug}
          href={`/exercises/${item.slug}`}
          className="group relative aspect-[4/5] overflow-hidden rounded-[var(--radius-lg)] border border-white/10 bg-neutral-900"
        >
          <Image
            src={item.imageUrl}
            alt={item.namePt}
            fill
            sizes="(max-width: 640px) 50vw, 240px"
            className="object-cover transition duration-500 group-hover:scale-105"
            priority={i < 3}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-3">
            {item.muscle ? (
              <span className="text-[10px] font-semibold uppercase tracking-wider text-accent-strong">
                {item.muscle}
              </span>
            ) : null}
            <p className="mt-0.5 text-sm font-semibold leading-tight text-white">{item.namePt}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}
