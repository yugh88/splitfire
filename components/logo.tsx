import Link from "next/link";

/** Pixel flame + wordmark. */
export function Logo({ compact }: { compact?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2" aria-label="Splitfire home">
      <svg viewBox="0 0 8 10" className="h-6 w-5" shapeRendering="crispEdges" aria-hidden>
        <rect x="3" y="0" width="1" height="1" fill="#fbbf24" />
        <rect x="3" y="1" width="2" height="1" fill="#fbbf24" />
        <rect x="2" y="2" width="3" height="1" fill="#ff6a2b" />
        <rect x="1" y="3" width="5" height="1" fill="#ff6a2b" />
        <rect x="1" y="4" width="6" height="2" fill="#f05252" />
        <rect x="3" y="4" width="2" height="2" fill="#fbbf24" />
        <rect x="1" y="6" width="6" height="2" fill="#f05252" />
        <rect x="3" y="6" width="2" height="1" fill="#ff6a2b" />
        <rect x="2" y="8" width="4" height="1" fill="#b91c1c" />
      </svg>
      {!compact && <span className="font-heading text-sm tracking-[0.2em]">SPLITFIRE</span>}
    </Link>
  );
}
