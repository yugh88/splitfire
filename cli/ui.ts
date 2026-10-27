/** TTY-aware colour helpers. Non-interactive output (CI, tests, pipes) stays plain. */
const enabled = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;

function wrap(code: number, text: string): string {
  return enabled ? `\u001b[${code}m${text}\u001b[0m` : text;
}

export const ui = {
  bold: (text: string) => wrap(1, text),
  dim: (text: string) => wrap(2, text),
  cyan: (text: string) => wrap(36, text),
  green: (text: string) => wrap(32, text),
  yellow: (text: string) => wrap(33, text),
  red: (text: string) => wrap(31, text),
};

/** Pads to a visible width, ignoring ANSI escapes in `text`. */
export function pad(text: string, width: number): string {
  const visible = text.replace(/\u001b\[[0-9;]*m/g, "").length;
  return visible >= width ? text : text + " ".repeat(width - visible);
}

export function truncate(text: string, width: number): string {
  return text.length <= width ? text : `${text.slice(0, Math.max(0, width - 1))}…`;
}
