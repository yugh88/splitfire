export type RepoRef = { owner: string; repo: string; ref?: string };

const NAME = /^[A-Za-z0-9_.-]+$/;

/** Accepts `owner/repo`, `github.com/owner/repo`, or a full URL (optionally `/tree/<ref>`). */
export function parseRepoUrl(input: string): RepoRef | null {
  const cleaned = input
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/^(www\.)?github\.com\//, "")
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "");
  const [owner, rawRepo, marker, ...rest] = cleaned.split("/");
  const repo = rawRepo?.replace(/\.git$/, "");
  if (!owner || !repo || !NAME.test(owner) || !NAME.test(repo)) return null;
  if (marker === "tree" && rest.length > 0) return { owner, repo, ref: rest.join("/") };
  if (marker !== undefined) return null;
  return { owner, repo };
}
