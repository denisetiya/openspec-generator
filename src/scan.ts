import { readdir } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { generateOpenApiYaml } from "./generator.js";
import { generateHtmlDashboard } from "./html.js";
import { generateMarkdownDocs } from "./markdown.js";
import { parseApiSpec } from "./parser.js";
import { postmanToDsl } from "./postman.js";
import { generateReport, validateApiSpec } from "./validator.js";
import type { ApiSpec } from "./types.js";

export type ScanResult = { files: string[]; merged: ApiSpec; outputDir: string; issues: number };

export async function scanSchemas(input: string, outputDir: string): Promise<ScanResult> {
  const files = await collectSchemaFiles(input);
  if (!files.length) throw new Error(`No DSL files found in ${input}.`);
  const apis: ApiSpec[] = [];
  for (const file of files) apis.push(await loadAny(file));
  const merged = mergeApis(apis, files);
  const issues = validateApiSpec(merged);
  await writeOutputs(merged, issues, outputDir);
  return { files, merged, outputDir, issues: issues.length };
}

export async function collectSchemaFiles(input: string): Promise<string[]> {
  const target = resolve(input);
  const ext = extname(target);
  if (ext) return [target];
  const entries = await readdir(target, { withFileTypes: true });
  const out: string[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!/\.(md|markdown|yaml|yml|json)$/i.test(entry.name)) continue;
    out.push(join(target, entry.name));
  }
  return out.sort();
}

export async function loadAny(file: string): Promise<ApiSpec> {
  const ext = extname(file).toLowerCase();
  const text = await (await import("node:fs/promises")).readFile(file, "utf8");
  if (ext === ".json") {
    try { return parseApiSpec(text); } catch { /* fallthrough */ }
    return parseApiSpec(postmanToDsl(JSON.parse(text)));
  }
  if (ext === ".yaml" || ext === ".yml") {
    try { return parseApiSpec(postmanToDsl(JSON.parse(text))); } catch { /* ignore */ }
  }
  return parseApiSpec(text);
}

export function mergeApis(apis: ApiSpec[], files: string[]): ApiSpec {
  const first = apis[0];
  return {
    title: first.title,
    version: first.version,
    description: [first.description, ...apis.slice(1).map((api) => api.description).filter(Boolean)].filter(Boolean).join(" / "),
    servers: dedupe(apis.flatMap((api) => api.servers)),
    endpoints: apis.flatMap((api) => api.endpoints),
  };
}

function dedupe(values: string[]): string[] {
  return values.filter((value, index) => value && values.indexOf(value) === index);
}

export async function writeOutputs(api: ApiSpec, issues: ReturnType<typeof validateApiSpec>, outputDir: string): Promise<void> {
  const { mkdir, writeFile } = await import("node:fs/promises");
  await mkdir(outputDir, { recursive: true });
  await writeFile(`${outputDir}/openapi.yaml`, generateOpenApiYaml(api));
  await writeFile(`${outputDir}/api-docs.md`, generateMarkdownDocs(api));
  await writeFile(`${outputDir}/dashboard.html`, generateHtmlDashboard(api));
  await writeFile(`${outputDir}/ai-report.md`, generateReport(api, issues));
}
