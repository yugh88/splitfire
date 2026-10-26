import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";

describe("toolchain", () => {
  it("resolves path aliases", () => {
    expect(cn("a", "b")).toBe("a b");
  });
});
