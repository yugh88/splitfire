"use client";

import { useMemo } from "react";

/** A one-shot burst of rising embers. Re-mount (change `key`) to replay. */
export function Embers({ count = 10, seed = 1 }: { count?: number; seed?: number }) {
  const embers = useMemo(() => {
    let s = seed * 9301 + 49297;
    const rand = () => (s = (s * 9301 + 49297) % 233280) / 233280;
    return Array.from({ length: count }, (_, i) => ({
      key: i,
      left: `${10 + rand() * 80}%`,
      dx: `${(rand() - 0.5) * 40}px`,
      delay: `${rand() * 0.4}s`,
    }));
  }, [count, seed]);

  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-0">
      {embers.map((e) => (
        <span
          key={e.key}
          className="ember"
          style={{ left: e.left, animationDelay: e.delay, ["--ember-x" as string]: e.dx }}
        />
      ))}
    </div>
  );
}
