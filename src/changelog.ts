import type { DiffEntry } from "./diff.js";

export function generateChangelog(entries: DiffEntry[], version: string, fromVersion: string): string {
  const lines: string[] = [];
  lines.push(`# Changelog`);
  lines.push("");
  lines.push(`## [${version}] - ${new Date().toISOString().split("T")[0]}`);
  lines.push("");
  const added = entries.filter((e) => e.kind === "added");
  const removed = entries.filter((e) => e.kind === "removed");
  const changed = entries.filter((e) => e.kind === "changed");
  const breaking = entries.filter((e) => e.kind === "removed" || e.details.some((d) => d.includes("removed") || d.includes("required: false → true")));
  if (breaking.length) {
    lines.push(`### ⚠️ BREAKING CHANGES`);
    for (const entry of breaking) {
      lines.push(`- ${entry.method} \`${entry.path}\``);
      for (const detail of entry.details.filter((d) => d.includes("removed") || d.includes("required: false → true"))) lines.push(`  - ${detail}`);
    }
    lines.push("");
  }
  if (added.length) {
    lines.push(`### Added`);
    for (const entry of added) lines.push(`- ${entry.method} \`${entry.path}\` — new endpoint`);
    lines.push("");
  }
  if (changed.length) {
    lines.push(`### Changed`);
    for (const entry of changed) {
      lines.push(`- ${entry.method} \`${entry.path}\``);
      for (const detail of entry.details) lines.push(`  - ${detail}`);
    }
    lines.push("");
  }
  if (removed.length && !breaking.length) {
    lines.push(`### Removed`);
    for (const entry of removed) lines.push(`- ${entry.method} \`${entry.path}\``);
    lines.push("");
  }
  if (!entries.length) lines.push("No changes.");
  lines.push("");
  lines.push(`Comparing ${fromVersion} → ${version}`);
  return lines.join("\n");
}
