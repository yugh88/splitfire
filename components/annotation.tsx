import { cn } from "@/lib/utils";

const ARROWS = {
  left: {
    viewBox: "0 0 28 18",
    className: "h-3.5 w-6",
    background: "M26 4C18 5 10 8 5 14",
    head: "M5 8v6h6",
  },
  right: {
    viewBox: "0 0 28 18",
    className: "h-3.5 w-6",
    background: "M2 4c8 1 16 4 21 10",
    head: "M17 14h6V8",
  },
  down: {
    viewBox: "0 0 18 26",
    className: "h-5 w-3.5",
    background: "M4 2c2 7 5 14 9 20",
    head: "M7 22h6v-6",
  },
} as const;

type Props = {
  children: React.ReactNode;
  arrow?: keyof typeof ARROWS;
  className?: string;
};

/**
 * A small handwritten margin note with a hand-drawn arrow. Used sparingly:
 * at most three or four per page. Decorative, so hidden from screen readers.
 */
export function Annotation({ children, arrow = "left", className }: Props) {
  const shape = ARROWS[arrow];
  const glyph = (
    <svg
      viewBox={shape.viewBox}
      className={cn("shrink-0", shape.className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={shape.background} />
      <path d={shape.head} />
    </svg>
  );
  return (
    <span aria-hidden className={cn("script-note inline-flex items-center gap-1.5", className)}>
      {arrow === "left" && glyph}
      <span className="whitespace-nowrap">{children}</span>
      {arrow !== "left" && glyph}
    </span>
  );
}
