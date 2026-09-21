import { Reading } from "@/components/models/compare"
import type { Cover } from "@/lib/posts/cover"

export function PostCover({ cover }: { cover: Cover }) {
  return (
    <figure className="mx-auto w-full max-w-[1200px] px-5 pb-14 sm:px-8 lg:pb-20">
      <div className="relative isolate -mx-5 overflow-hidden border-y border-hairline bg-sheet sm:mx-0 sm:rounded-md sm:border-x">
        <div
          aria-hidden
          className="paper-grain pointer-events-none absolute inset-0 -z-10"
        />
        <div className="grid items-center gap-x-16 gap-y-10 px-5 py-10 sm:px-10 sm:py-12 lg:grid-cols-[minmax(0,1fr)_22rem] lg:px-14 lg:py-16">
          <div>
            <p className="font-serif text-[1.35rem]/[1.55] text-pretty sm:text-[1.7rem]/[1.5]">
              {cover.pieces.map((piece, i) =>
                piece.marked ? (
                  <mark
                    key={i}
                    className="rounded-[3px] bg-marker box-decoration-clone px-0.5 text-ink"
                  >
                    {piece.text}
                  </mark>
                ) : (
                  <span key={i}>{piece.text}</span>
                )
              )}
            </p>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 font-mono text-[11px] text-graphite">
              {cover.reasons.map((reason) => (
                <li key={reason.id} className="flex items-center gap-2">
                  <span aria-hidden className="size-1.5 bg-marker" />
                  {reason.name} · {reason.id}
                </li>
              ))}
            </ul>
          </div>
          <Reading name="Standard" score={cover.score} />
        </div>
      </div>
      <figcaption className="mt-4 font-mono text-[11px] text-pretty text-graphite">
        A paragraph written to be obvious, read by the Standard model. The
        marked words are the ones that set its rules off.
      </figcaption>
    </figure>
  )
}
