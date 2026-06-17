import { mkdir, readFile, writeFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import YAML from "yaml";
import { loadConfig, resolveInputs, resolveOutput, type OpenSpecConfig } from "./config.js";
import { diffSpecs, formatDiffReport, isBreaking, loadSpec } from "./diff.js";
import { toCurl, toInsomnia, toPostman } from "./export.js";
import { formatDsl } from "./format.js";
import { generateOpenApiYaml } from "./generator.js";
import { generateHtmlDashboard } from "./html.js";
import { runInfer } from "./infer-cmd.js";
import { generateMarkdownDocs } from "./markdown.js";
import { startMockServer } from "./mock.js";
import { parseApiSpec } from "./parser.js";
import { postmanToDsl } from "./postman.js";
import { generateReadme } from "./readme.js";
import { collectSchemaFiles, loadAny, mergeApis, scanSchemas, writeOutputs } from "./scan.js";
import { generateTsSdk } from "./sdk.js";
import type { ApiSpec } from "./types.js";
import { generateReport, validateApiSpec } from "./validator.js";
import { lintSpec, formatLintReport } from "./lint.js";
import { generateChangelog } from "./changelog.js";
import { generateCoverageReport, loadCoverage, recordHit, saveCoverage } from "./coverage.js";
import { runChat } from "./chat.js";
import { aiFill, aiInfer, getLlmOptions } from "./llm.js";

export type CommandResult = { code: number; message?: string };

export async function runCommand(name: string, args: string[]): Promise<CommandResult> {
  const config = loadConfig();
  switch (name) {
    case "init": return runInit(args);
    case "generate": case "gen": case "g": return runGenerate(args, config);
    case "validate": case "check": return runValidate(args, config);
    case "format": case "fmt": return runFormat(args, config);
    case "import-postman": case "from-postman": return runImportPostman(args);
    case "scan": return runScan(args, config);
    case "watch": return runWatch(args, config);
    case "serve": return runServe(args, config);
    case "bundle": return runBundle(args, config);
    case "infer": return runInferCmd(args);
    case "chat": return runChatCmd(args);
    case "ai-fill": return runAiFill(args);
    case "ai-infer": return runAiInfer(args);
    case "mock": return runMock(args);
    case "diff": return runDiff(args);
    case "breaking": return runBreaking(args);
    case "lint": return runLintCmd(args, config);
    case "export-postman": return runExportPostman(args, config);
    case "export-insomnia": return runExportInsomnia(args, config);
    case "export-curl": return runExportCurl(args, config);
    case "readme": return runReadmeCmd(args, config);
    case "sdk": return runSdk(args, config);
    case "changelog": return runChangelogCmd(args);
    case "coverage": return runCoverage(args, config);
    case "hit": return runHit(args);
    case "help": case "--help": case "-h": return { code: 0, message: help() };
    case "version": case "--version": case "-v": return { code: 0, message: version() };
    default: return { code: 1, message: `Unknown command: ${name}\n\n${help()}` };
  }
}

async function runInit(args: string[]): Promise<CommandResult> {
  const { initProject } = await import("./init.js");
  await initProject(args[0] ?? ".");
  return { code: 0 };
}

async function runGenerate(args: string[], config: OpenSpecConfig): Promise<CommandResult> {
  const inputs = await resolveInputs(config, args);
  if (!inputs.length) return { code: 1, message: "No input files." };
  const outDir = resolveOutput(config, optionValue(args, "--out") ?? undefined);
  const merged = await mergeFiles(inputs);
  const issues = validateApiSpec(merged);
  await writeOutputs(merged, issues, outDir);
  console.log(`Generated ${outDir} (${merged.endpoints.length} endpoints, ${issues.length} issues)`);
  return { code: 0 };
}

async function runValidate(args: string[], config: OpenSpecConfig): Promise<CommandResult> {
  const inputs = await resolveInputs(config, args);
  if (!inputs.length) return { code: 1, message: "No input files." };
  const merged = await mergeFiles(inputs);
  const issues = validateApiSpec(merged);
  const errors = issues.filter((i) => i.level === "error").length;
  const warnings = issues.filter((i) => i.level === "warning").length;
  console.log(`${merged.endpoints.length} endpoints, ${errors} errors, ${warnings} warnings.`);
  for (const issue of issues) console.log(`- ${issue.level.toUpperCase()}${issue.endpoint ? ` [${issue.endpoint}]` : ""}: ${issue.message}`);
  return { code: errors > 0 ? 1 : 0 };
}

async function runFormat(args: string[], config: OpenSpecConfig): Promise<CommandResult> {
  const inputs = await resolveInputs(config, args);
  if (!inputs.length) return { code: 1, message: "No input files." };
  for (const file of inputs) {
    const api = await loadAny(file);
    const formatted = formatDsl(api);
    if (args.includes("--write")) {
      await writeFile(file, formatted);
      console.log(`Formatted ${file}`);
    } else process.stdout.write(formatted);
  }
  return { code: 0 };
}

async function runImportPostman(args: string[]): Promise<CommandResult> {
  const input = requireArg(args, 0, "postman file");
  const out = optionValue(args, "--out") ?? input.replace(extname(input), ".md");
  const raw = await readFile(resolve(input), "utf8");
  const dsl = postmanToDsl(JSON.parse(raw));
  await writeFile(resolve(out), dsl);
  console.log(`Converted Postman to ${out}`);
  return { code: 0 };
}

async function runBundle(args: string[], config: OpenSpecConfig): Promise<CommandResult> {
  const inputs = await resolveInputs(config, args);
  if (inputs.length < 2) return { code: 1, message: "bundle needs at least 2 input files." };
  const outDir = resolveOutput(config, optionValue(args, "--out") ?? undefined);
  const result = await scanSchemas(inputs[0], outDir);
  console.log(`Bundled ${result.files.length} files into ${outDir}`);
  return { code: 0 };
}

async function runScan(args: string[], config: OpenSpecConfig): Promise<CommandResult> {
  const target = args[0] ?? config.schemaDir ?? "schemas";
  const outDir = resolveOutput(config, optionValue(args, "--out") ?? undefined);
  const result = await scanSchemas(target, outDir);
  console.log(`Scanned ${result.files.length} schema files → ${outDir}`);
  console.log(`Endpoints: ${result.merged.endpoints.length}, issues: ${result.issues}`);
  if (args.includes("--watch") || config.watch) {
    const { existsSync, watch } = await import("node:fs");
    if (!existsSync(resolve(target))) return { code: 1, message: `${target} not found` };
    console.log(`Watching ${target} ...`);
    let running = false;
    const regenerate = async () => {
      if (running) return;
      running = true;
      try {
        const next = await scanSchemas(target, outDir);
        console.log(`[${new Date().toLocaleTimeString()}] regenerated ${outDir} (${next.files.length} files, ${next.issues} issues)`);
      } catch (error) { console.error(error instanceof Error ? error.message : error); }
      finally { running = false; }
    };
    watch(resolve(target), { persistent: true, recursive: true }, () => { void regenerate(); });
    return new Promise((resolveResult) => process.on("SIGINT", () => resolveResult({ code: 0 })));
  }
  return { code: 0 };
}

async function runWatch(args: string[], config: OpenSpecConfig): Promise<CommandResult> {
  return runScan([requireArg(args, 0, "input"), "--watch", ...args.slice(1)], config);
}

async function runServe(args: string[], config: OpenSpecConfig): Promise<CommandResult> {
  const port = Number(optionValue(args, "--port") ?? config.port ?? 4321);
  const outDir = resolveOutput(config, optionValue(args, "--dir") ?? undefined);
  const { createServer } = await import("node:http");
  const { stat } = await import("node:fs/promises");
  const types: Record<string, string> = { ".html": "text/html; charset=utf-8", ".yaml": "text/yaml", ".yml": "text/yaml", ".md": "text/markdown", ".json": "application/json" };
  const server = createServer(async (req, res) => {
    try {
      const url = req.url === "/" ? "/dashboard.html" : req.url ?? "/";
      const filePath = `${outDir}${url.split("?")[0]}`;
      const info = await stat(filePath);
      if (!info.isFile()) { res.statusCode = 404; res.end("Not found"); return; }
      const ext = extname(filePath);
      res.setHeader("content-type", types[ext] ?? "application/octet-stream");
      res.end(await readFile(filePath));
    } catch { res.statusCode = 404; res.end("Not found"); }
  });
  await new Promise<void>((r) => server.listen(port, () => r()));
  console.log(`OpenSpec dashboard: http://localhost:${port}/`);
  return new Promise((resolveResult) => process.on("SIGINT", () => { server.close(); resolveResult({ code: 0 }); }));
}

async function runInferCmd(args: string[]): Promise<CommandResult> {
  const input = requireArg(args, 0, "input file");
  const out = await runInfer(input, optionValue(args, "--out"));
  console.log(`Inferred DSL → ${out}`);
  return { code: 0 };
}

async function runChatCmd(args: string[]): Promise<CommandResult> {
  await runChat(args[0]);
  return { code: 0 };
}

async function runAiFill(args: string[]): Promise<CommandResult> {
  const input = requireArg(args, 0, "input file");
  const out = await aiFill(input, optionValue(args, "--out"), getLlmOptions(args));
  console.log(`AI-filled → ${out}`);
  return { code: 0 };
}

async function runAiInfer(args: string[]): Promise<CommandResult> {
  const input = requireArg(args, 0, "input file");
  const out = await aiInfer(input, optionValue(args, "--out"), getLlmOptions(args));
  console.log(`AI-inferred → ${out}`);
  return { code: 0 };
}

async function runMock(args: string[]): Promise<CommandResult> {
  const input = requireArg(args, 0, "spec file (yaml or md)");
  const port = Number(optionValue(args, "--port") ?? 3000);
  const cors = optionValue(args, "--cors") ?? "*";
  await startMockServer(input, port, cors);
  return new Promise((r) => process.on("SIGINT", () => r({ code: 0 })));
}

async function runDiff(args: string[]): Promise<CommandResult> {
  const oldPath = requireArg(args, 0, "old spec");
  const newPath = requireArg(args, 1, "new spec");
  const oldSpec = await loadSpec(oldPath);
  const newSpec = await loadSpec(newPath);
  const entries = diffSpecs(oldSpec, newSpec);
  const breaking = isBreaking(entries);
  const report = formatDiffReport(entries, breaking);
  const out = optionValue(args, "--out");
  if (out) { await writeFile(resolve(out), report); console.log(`Diff written to ${out}`); }
  else process.stdout.write(report);
  return { code: breaking.length > 0 ? 1 : 0 };
}

async function runBreaking(args: string[]): Promise<CommandResult> {
  const oldPath = requireArg(args, 0, "old spec");
  const newPath = requireArg(args, 1, "new spec");
  const oldSpec = await loadSpec(oldPath);
  const newSpec = await loadSpec(newPath);
  const breaking = isBreaking(diffSpecs(oldSpec, newSpec));
  if (!breaking.length) { console.log("No breaking changes."); return { code: 0 }; }
  console.log(`Breaking changes: ${breaking.length}`);
  for (const entry of breaking) {
    console.log(`  ${entry.method} ${entry.path}`);
    for (const detail of entry.details.filter((d) => d.includes("removed") || d.includes("required: false → true"))) console.log(`    - ${detail}`);
  }
  return { code: 1 };
}

async function runLintCmd(args: string[], config: OpenSpecConfig): Promise<CommandResult> {
  const inputs = await resolveInputs(config, args);
  if (!inputs.length) return { code: 1, message: "No input files." };
  const merged = await mergeFiles(inputs);
  const issues = lintSpec(merged);
  const report = formatLintReport(issues);
  const out = optionValue(args, "--out");
  if (out) { await writeFile(resolve(out), report); console.log(`Lint report written to ${out}`); }
  else process.stdout.write(report);
  return { code: issues.some((i) => i.level === "error") ? 1 : 0 };
}

async function runExportPostman(args: string[], config: OpenSpecConfig): Promise<CommandResult> {
  const inputs = await resolveInputs(config, args);
  if (!inputs.length) return { code: 1, message: "No input files." };
  const merged = await mergeFiles(inputs);
  const out = optionValue(args, "--out") ?? "postman-collection.json";
  await writeFile(resolve(out), JSON.stringify(toPostman(merged), null, 2));
  console.log(`Postman collection → ${out}`);
  return { code: 0 };
}


async function runExportInsomnia(args: string[], config: OpenSpecConfig): Promise<CommandResult> {
  const inputs = await resolveInputs(config, args);
  if (!inputs.length) return { code: 1, message: "No input files." };
  const merged = await mergeFiles(inputs);
  const out = optionValue(args, "--out") ?? "insomnia-export.json";
  await writeFile(resolve(out), JSON.stringify(toInsomnia(merged), null, 2));
  console.log(`Insomnia export → ${out}`);
  return { code: 0 };
}

async function runExportCurl(args: string[], config: OpenSpecConfig): Promise<CommandResult> {
  const inputs = await resolveInputs(config, args);
  if (!inputs.length) return { code: 1, message: "No input files." };
  const merged = await mergeFiles(inputs);
  const out = optionValue(args, "--out") ?? "curl-snippets.sh";
  await writeFile(resolve(out), toCurl(merged));
  console.log(`cURL snippets → ${out}`);
  return { code: 0 };
}

async function runReadmeCmd(args: string[], config: OpenSpecConfig): Promise<CommandResult> {
  const inputs = await resolveInputs(config, args);
  if (!inputs.length) return { code: 1, message: "No input files." };
  const merged = await mergeFiles(inputs);
  const out = optionValue(args, "--out") ?? "README.md";
  await writeFile(resolve(out), generateReadme(merged));
  console.log(`README → ${out}`);
  return { code: 0 };
}

async function runSdk(args: string[], config: OpenSpecConfig): Promise<CommandResult> {
  const inputs = await resolveInputs(config, args);
  if (!inputs.length) return { code: 1, message: "No input files." };
  const merged = await mergeFiles(inputs);
  const out = optionValue(args, "--out") ?? "sdk.ts";
  await writeFile(resolve(out), generateTsSdk(merged));
  console.log(`TypeScript SDK → ${out}`);
  return { code: 0 };
}

async function runChangelogCmd(args: string[]): Promise<CommandResult> {
  const oldPath = requireArg(args, 0, "old spec");
  const newPath = requireArg(args, 1, "new spec");
  const oldSpec = await loadSpec(oldPath);
  const newSpec = await loadSpec(newPath);
  const version = optionValue(args, "--version") ?? newSpec.version;
  const fromVersion = optionValue(args, "--from") ?? oldSpec.version;
  const entries = diffSpecs(oldSpec, newSpec);
  const out = optionValue(args, "--out") ?? "CHANGELOG.md";
  await writeFile(resolve(out), generateChangelog(entries, version, fromVersion));
  console.log(`Changelog → ${out}`);
  return { code: 0 };
}

async function runCoverage(args: string[], config: OpenSpecConfig): Promise<CommandResult> {
  const inputs = await resolveInputs(config, args);
  if (!inputs.length) return { code: 1, message: "No input files." };
  const merged = await mergeFiles(inputs);
  const covFile = resolve(".openspec-coverage.json");
  const entries = loadCoverage(covFile);
  const report = generateCoverageReport(merged, entries);
  const out = optionValue(args, "--out");
  if (out) { await writeFile(resolve(out), report); console.log(`Coverage report → ${out}`); }
  else process.stdout.write(report);
  return { code: 0 };
}

async function runHit(args: string[]): Promise<CommandResult> {
  const method = requireArg(args, 0, "method").toUpperCase();
  const path = requireArg(args, 1, "path");
  const covFile = resolve(".openspec-coverage.json");
  recordHit(covFile, method, path);
  console.log(`Recorded hit: ${method} ${path}`);
  return { code: 0 };
}

async function mergeFiles(inputs: string[]): Promise<ApiSpec> {
  if (inputs.length === 1) {
    const ext = extname(inputs[0]).toLowerCase();
    if (!ext) {
      const files = await collectSchemaFiles(inputs[0]);
      const apis = await Promise.all(files.map(loadAny));
      return mergeApis(apis, files);
    }
    return loadAny(inputs[0]);
  }
  const apis = await Promise.all(inputs.map(loadAny));
  return mergeApis(apis, inputs);
}

function requireArg(args: string[], index: number, label: string): string {
  const value = args[index];
  if (!value) throw new Error(`Missing ${label}.`);
  return value;
}

function optionValue(args: string[], flag: string): string | null {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] ?? null : null;
}

function help(): string {
  return `OpenSpec Generator CLI v0.2.0

AI-friendly Markdown DSL → OpenAPI 3.1 + readable docs + HTML dashboard + Try It.

Usage:
  openspec-generator <command> [options]

Core:
  init [path]                       Scaffold api.md + prompts/ai-api-doc-prompt.md
  generate [file|dir] --out <dir>   Build openapi.yaml, api-docs.md, dashboard.html, ai-report.md
  validate [file|dir]               Check completeness, exit 1 on errors
  format [file|dir] [--write]       Format DSL
  scan [dir] --out <dir> [--watch]  Scan folder of DSL files
  bundle <a> <b> ... --out <dir>    Merge multiple DSL files
  watch <file|dir> --out <dir>      Regenerate on file change
  serve --port 4321 --dir output    Serve generated dashboard

Import/Export:
  import-postman <file> --out <md>  Convert Postman v2.1 → DSL
  export-postman --out <json>       DSL → Postman collection
  export-insomnia --out <json>      DSL → Insomnia export
  export-curl --out <sh>            DSL → cURL snippets

AI:
  infer <notes> --out <dsl>         Heuristic DSL from free-form notes/curl
  chat [target]                     Interactive REPL DSL builder
  ai-fill <dsl> --out <dsl>         Use LLM to fill missing fields
  ai-infer <notes> --out <dsl>      Use LLM to convert notes to DSL
    --provider <anthropic|openai|mock>   (default: mock)
    --api-key <key>                       (or set ANTHROPIC_API_KEY / OPENAI_API_KEY)
    --model <model>                       (default: claude-3-5-sonnet / gpt-4o)

Server & Testing:
  mock <spec> --port 3000           Run mock server from spec
  diff <old> <new> --out <md>       Compare two specs, show changes
  breaking <old> <new>              Show only breaking changes, exit 1
  lint <file> --out <md>            Best-practice checker
  coverage <file> --out <md>        Endpoint coverage report
  hit <METHOD> <path>               Record endpoint hit for coverage

Generation:
  readme <file> --out <md>          Generate README.md
  sdk <file> --out <ts>             Generate TypeScript SDK
  changelog <old> <new> --version   Generate changelog from diff

Global:
  help                              Show this help
  version                           Show version

Config (.openspecrc.json):
  { "schemaFile": "api.md", "schemaDir": "schemas", "output": "docs/api", "watch": true, "port": 4321 }
`;
}

function version(): string { return "0.2.0"; }

export function cliName(): string { return "openspec-generator"; }
