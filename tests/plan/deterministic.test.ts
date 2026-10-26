import { describe, expect, it } from "vitest";
import { deterministicProposals } from "@/lib/plan/deterministic";
import { ProposalListSchema } from "@/lib/plan/schema";
import { requestTerms } from "@/lib/plan/relevance";
import { fixtureAnalysis } from "../helpers/plan";

describe("requestTerms", () => {
  it("drops stopwords and short words", () => {
    expect(requestTerms("Add a dark mode toggle to the Settings page")).toEqual([
      "dark",
      "mode",
      "toggle",
      "settings",
    ]);
  });
});

describe("deterministicProposals", () => {
  it("builds a valid plan around the files that match the request", async () => {
    const proposals = deterministicProposals(await fixtureAnalysis(), "change the math helpers");
    expect(ProposalListSchema.safeParse(proposals).success).toBe(true);
    const owned = proposals.flatMap((p) => p.ownedFiles);
    expect(owned).toContain("src/math.ts");
    expect(new Set(owned).size).toBe(owned.length);
  });

  it("still plans when nothing matches the request", async () => {
    const proposals = deterministicProposals(await fixtureAnalysis(), "zzz qqq");
    expect(proposals.length).toBeGreaterThan(0);
  });

  it("is deterministic", async () => {
    const analysis = await fixtureAnalysis();
    expect(deterministicProposals(analysis, "python models")).toEqual(
      deterministicProposals(analysis, "python models"),
    );
  });
});
