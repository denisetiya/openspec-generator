import type { ApiSpec } from "./types.js";

export function formatDsl(api: ApiSpec): string {
  const lines: string[] = [];
  lines.push(`API: ${api.title}`);
  lines.push(`Version: ${api.version}`);
  if (api.servers[0]) lines.push(`Server: ${api.servers[0]}`);
  if (api.description) lines.push(`ApiDescription: ${api.description}`);
  lines.push("");
  for (const endpoint of api.endpoints) {
    lines.push(`# ${endpoint.title}`);
    lines.push(`${endpoint.method} ${endpoint.path}`);
    if (endpoint.description) lines.push(`Description: ${endpoint.description}`);
    if (endpoint.auth) lines.push(`Auth: ${endpoint.auth}`);
    if (endpoint.flow) lines.push(`Flow: ${endpoint.flow}`);
    if (endpoint.dependsOn.length) lines.push(`DependsOn: ${endpoint.dependsOn.join(", ")}`);
    if (endpoint.conditions.length) {
      lines.push("Condition:");
      for (const condition of endpoint.conditions) lines.push(`- ${condition}`);
    }
    pushFields(lines, "PathParams", endpoint.pathParams, true);
    pushFields(lines, "Query", endpoint.queryParams, false);
    pushFields(lines, "Headers", endpoint.headers, true);
    if (endpoint.body) {
      const title = endpoint.body.kind === "formData" ? "FormData" : endpoint.body.kind === "urlEncoded" ? "UrlEncoded" : "Body";
      pushFields(lines, title, endpoint.body.fields, false);
    }
    for (const response of endpoint.responses) {
      lines.push(`${capitalize(response.name)} ${response.status}:`);
      pushFieldRows(lines, response.fields, response.name === "success");
    }
    lines.push("");
  }
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

function pushFields(lines: string[], title: string, fields: { name: string; type: string; required: boolean; description?: string; validation: Record<string, unknown> }[], defaultRequired: boolean): void {
  if (!fields.length) return;
  lines.push(`${title}:`);
  pushFieldRows(lines, fields, defaultRequired);
}

function pushFieldRows(lines: string[], fields: { name: string; type: string; required: boolean; description?: string; validation: Record<string, unknown> }[], defaultRequired: boolean): void {
  for (const field of fields) {
    const parts = [field.name, field.type];
    if (field.required !== defaultRequired) parts.push(field.required ? "required" : "optional");
    for (const [key, value] of Object.entries(field.validation)) parts.push(`${key}=${value}`);
    lines.push(`${parts.join(" ")}${field.description ? " - " + field.description : ""}`);
  }
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
