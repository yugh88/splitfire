import { Planner } from "@/components/planner";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-8 text-center">
        <h1 className="font-heading text-4xl tracking-tight sm:text-6xl">
          <span className="text-fire">Splitfire</span>
        </h1>
        <p className="text-muted-foreground mt-3 text-base sm:text-lg">
          Split the work. Not the codebase.
        </p>
        <p className="text-muted-foreground mx-auto mt-2 max-w-2xl text-sm">
          Turn a repo and a feature request into a collision-proof graph of tasks that parallel
          coding agents can run at the same time.
        </p>
      </header>
      <Planner />
    </main>
  );
}
