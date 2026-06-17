import { createInterface } from "node:readline";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { ApiSpec } from "./types.js";

export async function runChat(target: string | undefined): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q: string): Promise<string> => new Promise((res) => rl.question(q, (a) => res(a.trim())));
  console.log("OpenSpec Chat - interactive spec builder. Press Ctrl+C to exit.\n");
  const title = await ask("API name: ");
  const version = await ask("Version (default 1.0.0): ") || "1.0.0";
  const server = await ask("Base URL (default https://api.example.com): ") || "https://api.example.com";
  const desc = await ask("Description: ");
  const lines: string[] = [`API: ${title}`, `Version: ${version}`, `Server: ${server}`, `ApiDescription: ${desc}`, ""];
  let more = true;
  while (more) {
    const title2 = await ask("\nEndpoint title (empty to finish): ");
    if (!title2) { more = false; break; }
    const method = (await ask("Method (GET/POST/PUT/PATCH/DELETE): ")).toUpperCase() || "GET";
    const path = await ask("Path (e.g. /users): ") || "/";
    const description = await ask("Description: ");
    lines.push(`# ${title2}`);
    lines.push(`${method} ${path}`);
    if (description) lines.push(`Description: ${description}`);
    const addBody = await ask("Has body? (y/n): ");
    if (addBody.toLowerCase() === "y") {
      const bodyKind = (await ask("Body kind (json/formData/urlEncoded): ")).toLowerCase() || "json";
      const section = bodyKind === "formdata" ? "FormData" : bodyKind === "urlencoded" ? "UrlEncoded" : "Body";
      lines.push(`${section}:`);
      let addFields = true;
      while (addFields) {
        const fname = await ask("  Field name (empty to stop): ");
        if (!fname) { addFields = false; break; }
        const ftype = await ask("  Field type (string/email/integer/number/boolean/file): ") || "string";
        const freq = (await ask("  Required? (y/n): ")).toLowerCase() === "y" ? "required" : "optional";
        const fdesc = await ask("  Description: ");
        lines.push(`${fname} ${ftype} ${freq} - ${fdesc}`);
      }
    }
    const addResp = await ask("Add success response? (y/n): ");
    if (addResp.toLowerCase() === "y") {
      const status = await ask("  Status (default 200): ") || (method === "POST" ? "201" : "200");
      lines.push(`Success ${status}:`);
      let addFields = true;
      while (addFields) {
        const fname = await ask("  Field name (empty to stop): ");
        if (!fname) { addFields = false; break; }
        const ftype = await ask("  Field type: ") || "string";
        const fdesc = await ask("  Description: ");
        lines.push(`${fname} ${ftype} required - ${fdesc}`);
      }
    }
    lines.push("");
  }
  rl.close();
  const content = lines.join("\n");
  const outPath = target ? resolve(target) : resolve("api.md");
  await writeFile(outPath, content);
  console.log(`\nSaved to ${outPath}`);
  console.log("Next: openspec-generator generate " + outPath + " --out output");
}
