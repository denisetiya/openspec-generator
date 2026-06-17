import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { inferDsl } from "./infer.js";
import { parseApiSpec } from "./parser.js";
import { generateOpenApiYaml } from "./generator.js";
import { generateHtmlDashboard } from "./html.js";
import { generateMarkdownDocs } from "./markdown.js";
import { generateReport, validateApiSpec } from "./validator.js";

export type LlmProvider = "anthropic" | "openai" | "mock";

export type LlmOptions = { provider: LlmProvider; apiKey?: string; model?: string };

const PROMPT = `You are an API documentation expert. Convert the following free-form notes into OpenSpec Markdown DSL format.

DSL format:
\`\`\`
API: <name>
Version: <semver>
Server: <base url>
ApiDescription: <description>

# <Endpoint Title>
<METHOD> <PATH>
Description: <what endpoint does>
Auth: <auth type>
Tags: <tag1, tag2>
DependsOn: <other endpoint>
Flow: <process flow>
Condition:
- <business rule>

PathParams:
<name> <type> required <validation> - <description>

Query:
<name> <type> optional <validation> - <description>

Headers:
<name> <type> required - <description>

Body:
<name> <type> required <validation> - <description>

FormData:
<name> file required maxSize=2MB contentType=image/* - <description>

Success 200:
<name> <type> required - <description>

Error 400:
message string required - <error message>
\`\`\`

Rules:
- Always include Description, Success, Error.
- Every field must have a description after " - ".
- Use FormData for file upload.
- Use realistic names and examples.
- Output ONLY the DSL, no explanation.

Notes to convert:
`;

export async function aiFill(input: string, output: string | undefined | null, options: LlmOptions): Promise<string> {
  const notes = await readFile(resolve(input), "utf8");
  const dsl = await callLlm(notes, options);
  const outPath = output ? resolve(output) : resolve(input.replace(/\.[^.]+$/, "") + ".filled.md");
  await writeFile(outPath, dsl);
  return outPath;
}

export async function aiInfer(input: string, output: string | undefined | null, options: LlmOptions): Promise<string> {
  const notes = await readFile(resolve(input), "utf8");
  const dsl = await callLlm(notes, options);
  const outPath = output ? resolve(output) : resolve("api.md");
  await writeFile(outPath, dsl);
  return outPath;
}

async function callLlm(notes: string, options: LlmOptions): Promise<string> {
  if (options.provider === "mock") {
    return inferDsl(notes) + "\n# Note: this is a local inference, not actual AI.\n";
  }
  const prompt = PROMPT + "\n" + notes;
  if (options.provider === "anthropic") {
    if (!options.apiKey) throw new Error("Anthropic API key required (--api-key or ANTHROPIC_API_KEY env).");
    const model = options.model ?? "claude-3-5-sonnet-20241022";
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": options.apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model, max_tokens: 4096, messages: [{ role: "user", content: prompt }] }),
    });
    if (!res.ok) throw new Error(`Anthropic API error: ${res.status} ${await res.text()}`);
    const data = await res.json() as { content: Array<{ text: string }> };
    return data.content[0].text;
  }
  if (options.provider === "openai") {
    if (!options.apiKey) throw new Error("OpenAI API key required (--api-key or OPENAI_API_KEY env).");
    const model = options.model ?? "gpt-4o";
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${options.apiKey}` },
      body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }] }),
    });
    if (!res.ok) throw new Error(`OpenAI API error: ${res.status} ${await res.text()}`);
    const data = await res.json() as { choices: Array<{ message: { content: string } }> };
    return data.choices[0].message.content;
  }
  throw new Error(`Unknown provider: ${options.provider}`);
}

export function getLlmOptions(args: string[]): LlmOptions {
  const provider = (optionValue(args, "--provider") ?? process.env.OPENSPEC_LLM ?? "mock") as LlmProvider;
  const apiKey = optionValue(args, "--api-key") ?? process.env.ANTHROPIC_API_KEY ?? process.env.OPENAI_API_KEY;
  const model = optionValue(args, "--model") ?? undefined;
  return { provider, apiKey, model };
}

function optionValue(args: string[], flag: string): string | null {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] ?? null : null;
}
