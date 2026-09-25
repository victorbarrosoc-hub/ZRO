import Image from "next/image";

export type BackstagePost = { src: string; alt: string };

/**
 * Faixa de bastidores: posts 4:5 lado a lado, rolando na horizontal com encaixe
 * (como um carrossel do Instagram). A rolagem fica dentro da faixa: a página não alarga.
 */
export function BackstageStrip({ posts }: { posts: BackstagePost[] }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-4 [scrollbar-width:thin] sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
      <ul className="flex w-max snap-x snap-mandatory gap-3 sm:gap-4">
        {posts.map((p, i) => (
          <li key={p.src} className="w-[78vw] max-w-[420px] shrink-0 snap-start sm:w-[360px]">
            <Image
              src={p.src}
              width={1080}
              height={1350}
              alt={p.alt}
              sizes="(min-width: 640px) 420px, 78vw"
              priority={i === 0}
              className="h-auto w-full rounded-media border border-line"
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
