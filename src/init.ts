import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

export async function initProject(target: string): Promise<void> {
  const dir = resolve(target);
  await mkdir(dir, { recursive: true });
  await mkdir(`${dir}/prompts`, { recursive: true });
  await writeFile(`${dir}/api.md`, template);
  await writeFile(`${dir}/prompts/ai-api-doc-prompt.md`, aiPrompt);
  console.log(`Scaffolded OpenSpec project at ${dir}`);
  console.log("Edit api.md then run: openspec-generator generate api.md --out output");
}

const template = `API: My API
Version: 1.0.0
Server: https://api.example.com
ApiDescription: Jelaskan fungsi utama API.

# Hello World
GET /hello
Description: Endpoint sederhana untuk smoke test.
Query:
name string optional - Nama yang ingin di-sapa.

Success 200:
message string required - Pesan sapaan.
`;

const aiPrompt = `# AI API Doc Prompt

Isi Markdown DSL di bawah ini. Jangan tulis OpenAPI manual.

\`\`\`md
API: <nama>
Version: <semver>
Server: <base url>
ApiDescription: <deskripsi>

# <Title Endpoint>
<METHOD> <PATH>
Description: <deskripsi>
Auth: <Bearer token | API key | no auth>
DependsOn: <endpoint title/path>
Flow: <flow teks>
Condition:
- <aturan bisnis>
- <validasi>

PathParams:
<name> <type> required <validation> - <desc>

Query:
<name> <type> optional <validation> - <desc>

Headers:
<name> <type> required <validation> - <desc>

Body:
<name> <type> required <validation> - <desc>

FormData:
<name> file required maxSize=2MB contentType=image/* - <desc>

Success 200:
<name> <type> required <validation> - <desc>

Error 400:
message string required - Pesan error.
\`\`\`

Rules:
- Selalu isi Description, Success, Error.
- Setiap field wajib punya deskripsi setelah \` - \`.
- Pakai FormData untuk upload file.
- Tambahkan Condition untuk aturan bisnis.
- Tulis realistis, bukan boilerplate.
`;
