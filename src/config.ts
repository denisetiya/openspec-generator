import { existsSync, readFileSync, statSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

export type OpenSpecConfig = {
  input?: string | string[];
  output?: string;
  schemaDir?: string;
  schemaFile?: string;
  autoUpdate?: boolean;
  watch?: boolean;
  port?: number;
  serve?: boolean;
};

const CONFIG_FILES = [".openspecrc.json", "openspec.config.json", ".openspec.json"];

export function loadConfig(startDir: string = process.cwd()): OpenSpecConfig {
  for (const name of CONFIG_FILES) {
    const path = resolve(startDir, name);
    if (existsSync(path)) {
      try {
        const parsed = JSON.parse(readFileSync(path, "utf8")) as OpenSpecConfig;
        return parsed;
      } catch (error) {
        throw new Error(`Invalid config ${path}: ${error instanceof Error ? error.message : error}`);
      }
    }
  }
  return {};
}

export async function resolveInputs(config: OpenSpecConfig, args: string[]): Promise<string[]> {
  const flagsWithValue = new Set(["--out", "--dir", "--port", "--cors", "--from", "--version", "--model", "--provider", "--api-key", "--write"]);
  const explicit: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--") || arg.startsWith("-")) {
      const key = arg.split("=")[0];
      if (flagsWithValue.has(key) && !arg.includes("=") && i + 1 < args.length) i++;
      continue;
    }
    explicit.push(arg);
  }
  if (explicit.length) return explicit.map((value) => resolve(value));
  if (config.schemaFile) return [resolve(config.schemaFile)];
  if (config.input) return (Array.isArray(config.input) ? config.input : [config.input]).map((value) => resolve(value));
  if (config.schemaDir) {
    const { readdir } = await import("node:fs/promises");
    const dir = resolve(config.schemaDir);
    const entries = await readdir(dir);
    return entries.filter((name) => name.endsWith(".md") || name.endsWith(".yaml") || name.endsWith(".yml")).map((name) => resolve(dir, name));
  }
  return [];
}

export function resolveOutput(config: OpenSpecConfig, flagValue: string | null | undefined): string {
  return resolve(flagValue ?? config.output ?? "output");
}

export function isFile(path: string): boolean {
  try { return statSync(path).isFile(); } catch { return false; }
}
