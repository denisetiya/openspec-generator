import type { ApiSpec, EndpointSpec } from "./types.js";

export function generateReadme(api: ApiSpec): string {
  const lines: string[] = [];
  lines.push(`# ${api.title}`);
  lines.push("");
  if (api.description) { lines.push(api.description); lines.push(""); }
  lines.push(`Version: \`${api.version}\``);
  lines.push(`Base URL: \`${api.servers[0] ?? ""}\``);
  lines.push("");
  lines.push(`## Endpoints (${api.endpoints.length})`);
  lines.push("");
  lines.push("| Method | Path | Title | Description |");
  lines.push("| --- | --- | --- | --- |");
  for (const endpoint of api.endpoints) lines.push(`| ${endpoint.method} | \`${endpoint.path}\` | ${endpoint.title} | ${(endpoint.description ?? "").replace(/\|/g, "\\|")} |`);
  lines.push("");
  const groups = groupByTag(api.endpoints);
  if (groups.size > 0) {
    lines.push("## API Groups");
    for (const [tag, endpoints] of groups) {
      lines.push(`### ${tag}`);
      for (const endpoint of endpoints) lines.push(`- ${endpoint.method} \`${endpoint.path}\` — ${endpoint.title}`);
      lines.push("");
    }
  }
  lines.push("## Quick Start");
  lines.push("");
  lines.push("```bash");
  lines.push(`curl -X GET "${api.servers[0] ?? ""}/" \\`);
  lines.push(`  -H "Authorization: Bearer <token>"`);
  lines.push("```");
  lines.push("");
  lines.push("## Documentation");
  lines.push("");
  lines.push("Open \`output/dashboard.html\` in a browser for full interactive docs and Try It.");
  return lines.join("\n");
}

function groupByTag(endpoints: EndpointSpec[]): Map<string, EndpointSpec[]> {
  const groups = new Map<string, EndpointSpec[]>();
  for (const endpoint of endpoints) {
    if (!endpoint.tags.length) continue;
    for (const tag of endpoint.tags) {
      if (!groups.has(tag)) groups.set(tag, []);
      groups.get(tag)!.push(endpoint);
    }
  }
  return groups;
}
