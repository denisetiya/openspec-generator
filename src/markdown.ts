import type { ApiSpec, EndpointSpec, FieldSpec } from "./types.js";

export function generateMarkdownDocs(api: ApiSpec): string {
  const sections = [`# ${api.title}`, "", api.description ?? "Generated API documentation.", "", `Version: ${api.version}`, "", `Server: ${api.servers[0]}`, ""];
  for (const endpoint of api.endpoints) sections.push(endpointDocs(endpoint));
  return `${sections.join("\n").trim()}\n`;
}

function endpointDocs(endpoint: EndpointSpec): string {
  const lines = [`## ${endpoint.title}`, "", `\`${endpoint.method} ${endpoint.path}\``, "", endpoint.description ?? "No description provided.", ""];
  if (endpoint.auth) lines.push(`Auth: ${endpoint.auth}`, "");
  pushTable(lines, "Path Params", endpoint.pathParams);
  pushTable(lines, "Query Params", endpoint.queryParams);
  pushTable(lines, "Headers", endpoint.headers);
  if (endpoint.body) pushTable(lines, endpoint.body.kind === "formData" ? "Form Data Body" : "Request Body", endpoint.body.fields);
  for (const response of endpoint.responses) pushTable(lines, `${response.name} ${response.status}`, response.fields);
  return lines.join("\n");
}

function pushTable(lines: string[], title: string, fields: FieldSpec[]): void {
  if (fields.length === 0) return;
  lines.push(`### ${title}`, "", "| Field | Type | Required | Validation | Description |", "| --- | --- | --- | --- | --- |");
  for (const field of fields) {
    const validation = Object.entries(field.validation).map(([key, value]) => `${key}=${value}`).join(", ") || "-";
    lines.push(`| ${field.name} | ${field.type} | ${field.required ? "yes" : "no"} | ${validation} | ${field.description ?? "-"} |`);
  }
  lines.push("");
}
