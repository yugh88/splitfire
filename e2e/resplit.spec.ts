import { expect, test } from "@playwright/test";

test.use({
  permissions: ["clipboard-read", "clipboard-write"],
  viewport: { width: 1280, height: 900 },
});
test.setTimeout(60_000);

const TASKS = [
  {
    id: "t0",
    title: "Shared contracts",
    goal: "Define the shared types the other tasks build against.",
    kind: "contract",
    ownedFiles: ["src/types.ts"],
    readFiles: ["src/index.ts"],
    dependsOn: [],
    difficulty: 1,
    model: "fast",
    estTokens: 1_200,
    estCostUsd: 0,
    estMinutes: 10,
    acceptance: ["npx tsc --noEmit"],
  },
  {
    id: "t1",
    title: "Update src",
    goal: "Build the feature on the shared contracts.",
    kind: "feature",
    ownedFiles: ["src/a.ts", "src/b.ts", "src/c.ts"],
    readFiles: [],
    dependsOn: ["t0"],
    difficulty: 2,
    model: "strong",
    estTokens: 3_000,
    estCostUsd: 0.001,
    estMinutes: 30,
    acceptance: ["npx tsc --noEmit"],
  },
  {
    id: "t2",
    title: "Update tests",
    goal: "Cover the new flow with tests.",
    kind: "test",
    ownedFiles: ["tests/a.test.ts"],
    readFiles: ["src/a.ts"],
    dependsOn: [],
    difficulty: 1,
    model: "fast",
    estTokens: 800,
    estCostUsd: 0,
    estMinutes: 20,
    acceptance: ["npx vitest run"],
  },
];

const DRAFT = [
  { id: "t0", title: "Shared contracts", ownedFiles: ["src/types.ts", "src/b.ts"] },
  { id: "t1", title: "Update src", ownedFiles: ["src/a.ts", "src/b.ts", "src/c.ts"] },
  { id: "t2", title: "Update tests", ownedFiles: ["tests/a.test.ts"] },
];
const COLLISIONS = [{ file: "src/b.ts", tasks: ["t0", "t1"] }];
const REPAIRS = [{ kind: "owner", file: "src/b.ts", winner: "t1", loser: "t0" }];
const METRICS = {
  collisionScore: 0,
  serialMinutes: 60,
  parallelMinutes: 40,
  speedup: 1.5,
  agents: 2,
  tokensFullRepo: 120_000,
  tokensWithPacks: 20_000,
  totalCostUsd: 0.001,
  criticalPath: ["t0", "t1"],
};
const REPORT = {
  plan: {
    id: "aaaaaaaaaaaaaaaa",
    repo: "acme/storefront",
    sha: "abcdef1234567",
    request: "Add OAuth login",
    tasks: TASKS,
    ...METRICS,
  },
  planner: "mock",
  notice: null,
  draft: DRAFT,
  collisions: COLLISIONS,
  collisionScoreBefore: 1,
  repairs: REPAIRS,
  criticalPath: ["t0", "t1"],
};

const sse = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
const STREAM = [
  sse("ingested", {
    repo: "acme/storefront",
    sha: "abcdef1234567",
    files: 5,
    skipped: 0,
    truncated: false,
    cacheHit: false,
  }),
  sse("graph", { files: [], edges: [], parser: "tree-sitter" }),
  sse("partitioned", {
    tasks: TASKS,
    draft: DRAFT,
    collisions: COLLISIONS,
    collisionScoreBefore: 1,
    collisionScore: 0,
    repairs: REPAIRS,
  }),
  sse("metrics", METRICS),
  sse("done", REPORT),
].join("");

test("drags a file between tasks and the live score updates", async ({ page, context }) => {
  await page.route("**/api/plan", (route) =>
    route.fulfill({
      status: 200,
      headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache" },
      body: STREAM,
    }),
  );
  await page.goto("/");
  await page
    .getByPlaceholder("https://github.com/owner/repo")
    .fill("https://github.com/acme/storefront");
  await page.getByPlaceholder(/Add dark mode/).fill("Add OAuth login");
  await page.getByRole("button", { name: "Ignite plan" }).click();

  const metrics = page.locator('[aria-label="Plan metrics"]:visible');
  await expect(metrics).toBeVisible({ timeout: 15_000 });

  const nodes = page.locator('[data-testid="task-node"]');
  const info = await nodes.evaluateAll((els) =>
    els
      .map((el) => {
        const files = Number(el.getAttribute("data-files"));
        const minutes = Number(el.getAttribute("data-minutes"));
        return {
          id: el.getAttribute("data-task-id") ?? "",
          critical: el.getAttribute("data-critical") === "true",
          files,
          rate: files > 0 ? minutes / files : 0,
        };
      })
      .filter((n) => n.id && n.files > 0),
  );

  // Move effort from a task that is off the critical path onto one that is on it, so the
  // critical path and speedup must move. If everything is critical, pick different file rates.
  const targetInfo = info.find((n) => n.critical) ?? info.at(-1)!;
  const sourceInfo =
    info.find((n) => !n.critical && n.id !== targetInfo.id) ??
    info.find((n) => n.id !== targetInfo.id && n.rate !== targetInfo.rate) ??
    info.find((n) => n.id !== targetInfo.id)!;

  const source = page.locator(`[data-testid="task-node"][data-task-id="${sourceInfo.id}"]`);
  const target = page.locator(`[data-testid="task-node"][data-task-id="${targetInfo.id}"]`);
  await source.click();

  const toolbar = page.getByTestId("resplit-toolbar");
  await expect(toolbar).toBeVisible();
  const beforeCritical = await toolbar.getByTestId("resplit-critical").innerText();
  const targetFiles = targetInfo.files;
  const file = await page.getByTestId("owned-file-drag").first().getAttribute("data-file");

  // Drag an owned file from the task detail panel onto another task node.
  await page.getByTestId("owned-file-drag").first().dragTo(target);

  await expect(toolbar.getByTestId("resplit-moves")).toHaveText("1 move");
  await expect(toolbar.getByTestId("resplit-last-move")).toContainText(file ?? "");
  await expect(toolbar.getByTestId("resplit-critical")).not.toHaveText(beforeCritical);
  await expect(toolbar.getByTestId("resplit-collisions")).toHaveText("0");
  await expect(target).toHaveAttribute("data-files", String(targetFiles + 1));

  // Cmd/Ctrl+Z restores the original ownership and score.
  await page.keyboard.press(process.platform === "darwin" ? "Meta+z" : "Control+z");
  await expect(toolbar.getByTestId("resplit-moves")).toHaveText("0 moves");
  await expect(toolbar.getByTestId("resplit-critical")).toHaveText(beforeCritical);

  // The select is the keyboard/touch alternative to dragging that same file.
  const select = page.getByRole("combobox", { name: `Move ${file} to another task` });
  await select.selectOption(targetInfo.id);
  await expect(toolbar.getByTestId("resplit-moves")).toHaveText("1 move");
  await page.keyboard.press(process.platform === "darwin" ? "Meta+z" : "Control+z");
  await expect(toolbar.getByTestId("resplit-moves")).toHaveText("0 moves");

  // In the heatmap, a drop in flight shows the overlap in red until it resolves.
  await page.getByRole("tab", { name: /heatmap/i }).click();
  const source2 = page.getByTestId("owned-file-drag").first();
  const column = page.locator(
    `section:has-text("After Splitfire") th[data-task-id="${targetInfo.id}"]`,
  );
  const transfer = await page.evaluateHandle(() => new DataTransfer());
  await source2.dispatchEvent("dragstart", { dataTransfer: transfer });
  await column.dispatchEvent("dragenter", { dataTransfer: transfer });
  await column.dispatchEvent("dragover", { dataTransfer: transfer });
  await expect(toolbar.getByTestId("resplit-preview")).toBeVisible();
  await expect(toolbar.getByTestId("resplit-collisions")).toHaveText("1");
  await column.dispatchEvent("drop", { dataTransfer: transfer });
  await expect(toolbar.getByTestId("resplit-collisions")).toHaveText("0");
  await expect(toolbar.getByTestId("resplit-moves")).toHaveText("1 move");

  // Saving calls the share flow and the new page reflects the edited plan.
  const editedSpeedup = await toolbar.getByTestId("resplit-speedup").innerText();
  await page.getByRole("button", { name: /save as share link/i }).click();
  const link = page.getByTestId("resplit-link");
  await expect(link).toBeVisible({ timeout: 15_000 });
  const href = await link.getAttribute("href");
  expect(href).toMatch(/\/p\/[a-f0-9]{16}$/);

  const shared = await context.newPage();
  await shared.goto(href!);
  await expect(shared.locator('[aria-label="Plan metrics"]:visible')).toBeVisible();
  await expect(shared.getByTestId("resplit-speedup")).toHaveText(editedSpeedup);
  await expect(shared.getByTestId("resplit-moves")).toHaveText("0 moves");
});
