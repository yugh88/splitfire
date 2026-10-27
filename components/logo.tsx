import Link from "next/link";

/** Flame mark + wordmark, set in Inter Tight. */
export function Logo({ compact }: { compact?: boolean }) {
  return (
    <Link href="/" className="group flex items-center gap-2" aria-label="Splitfire home">
      <span className="relative flex size-7 items-center justify-center">
        <span className="bg-fire-orange/25 absolute inset-1 rounded-full blur-md transition-opacity duration-500 group-hover:opacity-100" />
        <svg viewBox="0 0 24 24" className="relative h-6 w-6" aria-hidden>
          <defs>
            <linearGradient id="splitfire-flame" x1="12" y1="2" x2="12" y2="22">
              <stop stopColor="#F5A524" />
              <stop offset="0.55" stopColor="#FF6A2B" />
              <stop offset="1" stopColor="#F05252" />
            </linearGradient>
          </defs>
          <path
            fill="url(#splitfire-flame)"
            d="M12 1.8c.6 3.5 2.3 5.7 4.3 7.7 1.9 1.9 3.7 4 3.7 6.9a8 8 0 1 1-16 0c0-2.1 1-3.9 2.6-5.3.4 1.4 1.2 2.3 2.5 2.8C9.3 10.5 10.1 5.7 12 1.8Z"
          />
          <path
            fill="#0A0A0F"
            fillOpacity="0.22"
            d="M12 21.2a4 4 0 0 0 4.1-4.1c0-2.3-2.4-3.6-3.2-5.8-.9 1.6-2.9 2.5-2.9 5.8a4 4 0 0 0 2 4.1Z"
          />
        </svg>
      </span>
      {!compact && (
        <span className="font-display text-[17px] font-extrabold tracking-[-0.03em]">
          Splitfire
        </span>
      )}
    </Link>
  );
}
