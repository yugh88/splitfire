const BLOBS = [
  {
    className: "ambient-blob -top-[18%] left-[-10%] h-[46vw] w-[46vw] min-h-64 min-w-64",
    background:
      "radial-gradient(circle at 50% 50%, rgba(255, 106, 43, 0.34), rgba(255, 106, 43, 0) 70%)",
    duration: "48s",
    delay: "0s",
  },
  {
    className: "ambient-blob top-[8%] right-[-14%] h-[52vw] w-[52vw] min-h-72 min-w-72",
    background:
      "radial-gradient(circle at 50% 50%, rgba(245, 165, 36, 0.30), rgba(245, 165, 36, 0) 70%)",
    duration: "58s",
    delay: "-12s",
  },
  {
    className:
      "ambient-blob bottom-[-24%] left-[22%] h-[44vw] w-[44vw] min-h-64 min-w-64 opacity-40",
    background:
      "radial-gradient(circle at 50% 50%, rgba(92, 200, 255, 0.22), rgba(92, 200, 255, 0) 70%)",
    duration: "54s",
    delay: "-26s",
  },
];

/** Deterministic ember cloud so server and client markup match. */
const EMBERS = Array.from({ length: 18 }, (_, i) => {
  const rand = (n: number) => (((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1) + 1) % 1;
  const size = 2 + Math.round(rand(1) * 3);
  return {
    key: i,
    left: `${4 + rand(2) * 92}%`,
    size,
    drift: `${Math.round((rand(3) - 0.5) * 120)}px`,
    duration: `${24 + Math.round(rand(4) * 30)}s`,
    delay: `-${Math.round(rand(5) * 40)}s`,
    peak: `${(0.14 + rand(6) * 0.22).toFixed(2)}`,
  };
});

/**
 * Full-viewport ambience: three slow gradient blobs, a faint grid, fine noise
 * and a few rising embers. Pure CSS transforms/opacity, pointer-events none.
 */
export function AmbientBackground() {
  return (
    <div aria-hidden className="ambient pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="ambient-grid absolute inset-0" />
      {BLOBS.map((blob) => (
        <div
          key={blob.className}
          className={blob.className}
          style={{
            background: blob.background,
            ["--duration" as string]: blob.duration,
            ["--delay" as string]: blob.delay,
          }}
        />
      ))}
      <div className="ambient-noise absolute inset-0" />
      <div className="ambient-vignette absolute inset-0" />
      {EMBERS.map((ember) => (
        <span
          key={ember.key}
          className="ambient-ember"
          style={{
            left: ember.left,
            width: ember.size,
            height: ember.size,
            ["--drift" as string]: ember.drift,
            ["--duration" as string]: ember.duration,
            ["--delay" as string]: ember.delay,
            ["--peak" as string]: ember.peak,
          }}
        />
      ))}
    </div>
  );
}
