import Link from "next/link";
import { Logo } from "@/components/logo";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <Logo />
      <h1 className="font-heading text-2xl">Plan not found</h1>
      <p className="text-muted-foreground max-w-md text-sm">
        This link may have expired (plans are kept for 30 days) or never existed.
      </p>
      <Link href="/" className="text-fire-amber text-sm underline underline-offset-4">
        Split a repo
      </Link>
    </main>
  );
}
