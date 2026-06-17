import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import YAML from "yaml";
import { fromOpenApi } from "./openapi.js";
import { parseApiSpec } from "./parser.js";
import type { ApiSpec } from "./types.js";

export type DiffEntry = { kind: "added" | "removed" | "changed"; path: string; method?: string; details: string[] };

export function diffSpecs(oldSpec: ApiSpec, newSpec: ApiSpec): DiffEntry[] {
  const entries: DiffEntry[] = [];
  const oldMap = new Map(oldSpec.endpoints.map((endpoint) => [endpoint.method + " " + endpoint.path, endpoint]));
  const newMap = new Map(newSpec.endpoints.map((endpoint) => [endpoint.method + " " + endpoint.path, endpoint]));

  for (const [key, newEndpoint] of newMap) {
    if (!oldMap.has(key)) {
      entries.push({ kind: "added", path: newEndpoint.path, method: newEndpoint.method, details: ["Endpoint added."] });
      continue;
    }
    const oldEndpoint = oldMap.get(key)!;
    const changes: string[] = [];
    if (oldEndpoint.title !== newEndpoint.title) changes.push(`Title: "${oldEndpoint.title}" → "${newEndpoint.title}"`);
    if ((oldEndpoint.description ?? "") !== (newEndpoint.description ?? "")) changes.push("Description changed.");
    const oldParams = new Map([...oldEndpoint.pathParams, ...oldEndpoint.queryParams].map((p) => [p.name, p]));
    const newParams = new Map([...newEndpoint.pathParams, ...newEndpoint.queryParams].map((p) => [p.name, p]));
    for (const [name, param] of newParams) {
      if (!oldParams.has(name)) changes.push(`Parameter added: ${name}`);
      else {
        const oldParam = oldParams.get(name)!;
        if (oldParam.type !== param.type) changes.push(`Parameter ${name} type: ${oldParam.type} → ${param.type}`);
        if (oldParam.required !== param.required) changes.push(`Parameter ${name} required: ${oldParam.required} → ${param.required}`);
      }
    }
    for (const name of oldParams.keys()) {
      if (!newParams.has(name)) changes.push(`Parameter removed: ${name}`);
    }
    if (oldEndpoint.body && !newEndpoint.body) changes.push("Request body removed.");
    if (!oldEndpoint.body && newEndpoint.body) changes.push("Request body added.");
    if (oldEndpoint.body && newEndpoint.body) {
      if (oldEndpoint.body.kind !== newEndpoint.body.kind) changes.push(`Body kind: ${oldEndpoint.body.kind} → ${newEndpoint.body.kind}`);
      const oldFields = new Map(oldEndpoint.body.fields.map((f) => [f.name, f]));
      const newFields = new Map(newEndpoint.body.fields.map((f) => [f.name, f]));
      for (const [name, field] of newFields) {
        if (!oldFields.has(name)) changes.push(`Body field added: ${name}`);
        else {
          const oldField = oldFields.get(name)!;
          if (oldField.type !== field.type) changes.push(`Body field ${name} type: ${oldField.type} → ${field.type}`);
          if (oldField.required !== field.required) changes.push(`Body field ${name} required: ${oldField.required} → ${field.required}`);
        }
      }
      for (const name of oldFields.keys()) {
        if (!newFields.has(name)) changes.push(`Body field removed: ${name}`);
      }
    }
    const oldResps = new Map(oldEndpoint.responses.map((r) => [r.status, r]));
    const newResps = new Map(newEndpoint.responses.map((r) => [r.status, r]));
    for (const [status, resp] of newResps) {
      if (!oldResps.has(status)) changes.push(`Response ${status} added.`);
    }
    for (const status of oldResps.keys()) {
      if (!newResps.has(status)) changes.push(`Response ${status} removed.`);
    }
    if (changes.length) entries.push({ kind: "changed", path: newEndpoint.path, method: newEndpoint.method, details: changes });
  }

  for (const [key, oldEndpoint] of oldMap) {
    if (!newMap.has(key)) {
      entries.push({ kind: "removed", path: oldEndpoint.path, method: oldEndpoint.method, details: ["Endpoint removed."] });
    }
  }

  return entries;
}

export function isBreaking(entries: DiffEntry[]): DiffEntry[] {
  return entries.filter((entry) => entry.kind === "removed" || entry.details.some((detail) => detail.includes("removed") || detail.includes("required: false → true") || detail.includes("type:") || detail.includes("Response")));
}

export async function loadSpec(input: string): Promise<ApiSpec> {
  const ext = input.split(".").pop()?.toLowerCase();
  const text = await readFile(resolve(input), "utf8");
  if (ext === "yaml" || ext === "yml") {
    const parsed = YAML.parse(text);
    if (parsed?.openapi || parsed?.swagger) return fromOpenApi(JSON.stringify(parsed));
    return parseApiSpec(text);
  }
  if (ext === "json") {
    try {
      const parsed = JSON.parse(text);
      if (parsed?.openapi || parsed?.swagger) return fromOpenApi(JSON.stringify(parsed));
      if (parsed?.info && parsed?.item) return parseApiSpec(convertPostmanToDsl(parsed));
    } catch {}
  }
  return parseApiSpec(text);
}

function convertPostmanToDsl(collection: { info?: { name?: string }; item?: unknown[] }): string {
  const { postmanToDsl } = require("./postman.js");
  return postmanToDsl(collection);
}

export function formatDiffReport(entries: DiffEntry[], breaking: DiffEntry[]): string {
  const lines: string[] = ["# API Diff Report", "", `Total changes: ${entries.length}`, `Breaking changes: ${breaking.length}`, ""];
  if (entries.length === 0) {
    lines.push("No changes detected.");
    return lines.join("\n");
  }
  const groups = { added: entries.filter((e) => e.kind === "added"), removed: entries.filter((e) => e.kind === "removed"), changed: entries.filter((e) => e.kind === "changed") };
  if (groups.added.length) {
    lines.push("## Added");
    for (const entry of groups.added) lines.push(`- ${entry.method} ${entry.path}`);
    lines.push("");
  }
  if (groups.removed.length) {
    lines.push("## Removed (BREAKING)");
    for (const entry of groups.removed) lines.push(`- ${entry.method} ${entry.path}`);
    lines.push("");
  }
  if (groups.changed.length) {
    lines.push("## Changed");
    for (const entry of groups.changed) {
      lines.push(`### ${entry.method} ${entry.path}`);
      for (const detail of entry.details) {
        const isBreak = detail.includes("removed") || detail.includes("required: false → true");
        lines.push(`- ${isBreak ? "⚠️ " : ""}${detail}`);
      }
      lines.push("");
    }
  }
  return lines.join("\n");
}
