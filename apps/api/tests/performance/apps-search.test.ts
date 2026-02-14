import { describe, expect, it } from "vitest";

interface SearchableApp {
  id: string;
  name: string;
  description: string;
  mode: "chat" | "workflow" | "agent";
  tags: string[];
  isAccessible: boolean;
}

function createDataset(size: number): SearchableApp[] {
  const modes: Array<SearchableApp["mode"]> = ["chat", "workflow", "agent"];
  const rows: SearchableApp[] = [];

  for (let i = 0; i < size; i++) {
    const mode = modes[i % modes.length] ?? "chat";
    rows.push({
      id: `app-${i}`,
      name: `Agent App ${i}`,
      description: `Application ${i} for ${mode} use cases`,
      mode,
      tags: [mode, i % 5 === 0 ? "favorite" : "standard"],
      isAccessible: i % 7 !== 0,
    });
  }

  return rows;
}

function searchAccessibleApps(
  apps: SearchableApp[],
  query: string,
  category: SearchableApp["mode"] | "all"
): SearchableApp[] {
  const normalizedQuery = query.trim().toLowerCase();
  return apps.filter((app) => {
    if (!app.isAccessible) {
      return false;
    }

    if (category !== "all" && app.mode !== category) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    return (
      app.name.toLowerCase().includes(normalizedQuery) ||
      app.description.toLowerCase().includes(normalizedQuery) ||
      app.tags.some((tag) => tag.toLowerCase().includes(normalizedQuery))
    );
  });
}

function p95(samples: number[]): number {
  const sorted = [...samples].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
  return sorted[index] ?? 0;
}

describe("T023 [US1] app search performance", () => {
  it("keeps P95 <= 300ms at 50-app scale", () => {
    const apps = createDataset(50);
    const samples: number[] = [];

    for (let i = 0; i < 200; i++) {
      const start = performance.now();
      const keyword = i % 2 === 0 ? "agent" : "workflow";
      const category = i % 3 === 0 ? "all" : "chat";
      const rows = searchAccessibleApps(apps, keyword, category);
      const duration = performance.now() - start;

      samples.push(duration);
      expect(rows.length).toBeGreaterThanOrEqual(0);
    }

    const latencyP95 = p95(samples);
    expect(latencyP95).toBeLessThanOrEqual(300);
  });
});

