import { inferDsl } from "./infer.js";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

export async function runInfer(input: string, output: string | undefined | null): Promise<string> {
  const { readFile } = await import("node:fs/promises");
  const text = await readFile(resolve(input), "utf8");
  const dsl = inferDsl(text);
  const outPath = output ? resolve(output) : resolve(input.replace(/\.[^.]+$/, "") + ".inferred.md");
  await writeFile(outPath, dsl);
  return outPath;
}
