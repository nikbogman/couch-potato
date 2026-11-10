// Test helper: a D1-shaped wrapper over bun:sqlite with the real migrations applied, so the store's SQL runs for real in-process.
import { Database } from "bun:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import type { D1Like } from "./store";
import { createProgressStore } from "./store";

export function memoryD1(): D1Like {
  const db = new Database(":memory:");
  const dir = new URL("../../migrations/", import.meta.url);
  for (const f of readdirSync(dir).sort()) db.run(readFileSync(new URL(f, dir), "utf8"));
  return {
    prepare: (sql) => ({
      bind: (...v) => ({
        first: async <T>() => db.query(sql).get(...(v as never[])) as T | null,
        all: async <T>() => ({ results: db.query(sql).all(...(v as never[])) as T[] }),
        run: async () => ({ meta: { changes: db.query(sql).run(...(v as never[])).changes } }),
      }),
    }),
  };
}

export const memoryStore = (now?: () => number) => createProgressStore(memoryD1(), now);
