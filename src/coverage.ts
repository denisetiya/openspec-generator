import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export type CoverageEntry = { method: string; path: string; hits: number; lastHit: string };

export type CoverageReport = { entries: CoverageEntry[]; totalEndpoints: number };

export function loadCoverage(file: string): CoverageEntry[] {
  if (!existsSync(file)) return [];
  try { return JSON.parse(readFileSync(file, "utf8")); } catch { return []; }
}

export function saveCoverage(file: string, entries: CoverageEntry[]): void {
  writeFileSync(file, JSON.stringify(entries, null, 2));
}

export function recordHit(file: string, method: string, path: string): void {
  const entries = loadCoverage(file);
  const existing = entries.find((e) => e.method === method && e.path === path);
  if (existing) {
    existing.hits++;
    existing.lastHit = new Date().toISOString();
  } else {
    entries.push({ method, path, hits: 1, lastHit: new Date().toISOString() });
  }
  saveCoverage(file, entries);
}

export function generateCoverageReport(spec: { endpoints: { method: string; path: string }[] }, entries: CoverageEntry[]): string {
  const lines: string[] = ["# Coverage Report", ""];
  const total = spec.endpoints.length;
  const hit = spec.endpoints.filter((e) => entries.some((c) => c.method === e.method && c.path === e.path)).length;
  const pct = total > 0 ? Math.round((hit / total) * 100) : 0;
  lines.push(`Coverage: ${hit}/${total} endpoints (${pct}%)`);
  lines.push("");
  lines.push("| Method | Path | Hits | Last Hit |");
  lines.push("| --- | --- | --- | --- |");
  for (const e of spec.endpoints) {
    const c = entries.find((x) => x.method === e.method && x.path === e.path);
    lines.push(`| ${e.method} | \`${e.path}\` | ${c?.hits ?? 0} | ${c?.lastHit ?? "-"} |`);
  }
  return lines.join("\n");
}
