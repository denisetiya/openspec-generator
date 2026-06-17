import type { ApiSpec, BodyKind, BodySpec, EndpointSpec, FieldSpec, HttpMethod, ResponseSpec } from "./types.js";

const HTTP_METHODS: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

type InferenceHint = { method?: HttpMethod; path?: string; title?: string };

export function inferDsl(input: string, hint: InferenceHint = {}): string {
  const cleaned = input.replace(/\r\n/g, "\n");
  const lines = cleaned.split("\n");
  const endpoint: Partial<EndpointSpec> & { responses: ResponseSpec[]; pathParams: FieldSpec[]; queryParams: FieldSpec[]; headers: FieldSpec[]; conditions: string[]; tags: string[]; dependsOn: string[] } = {
    title: hint.title ?? "Inferred Endpoint",
    method: hint.method ?? "GET",
    path: hint.path ?? "/",
    responses: [],
    pathParams: [],
    queryParams: [],
    headers: [],
    conditions: [],
    tags: [],
    dependsOn: [],
  };

  let bodyKind: BodyKind | undefined;
  let bodyFields: FieldSpec[] = [];
  let currentSection: "headers" | "query" | "body" | "json" | "form" | "urlencoded" | "path" | "response" | null = null;
  let currentResponse: ResponseSpec | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("//") || line.startsWith("# ") || line === "---") continue;

    const methodMatch = line.match(/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(\S+)/i);
    if (methodMatch) {
      endpoint.method = methodMatch[1].toUpperCase() as HttpMethod;
      endpoint.path = methodMatch[2];
      continue;
    }

    if (line.match(/^(curl|http)\s+/i) || line.startsWith("$ ")) {
      parseCurlLine(line, endpoint, bodyFields, () => bodyKind);
      bodyKind = detectBodyKind(bodyFields, bodyKind);
      continue;
    }

    const lower = line.toLowerCase();
    if (lower === "headers:" || lower === "header:") { currentSection = "headers"; continue; }
    if (lower === "query:" || lower === "query params:" || lower === "queryparams:") { currentSection = "query"; continue; }
    if (lower === "path:" || lower === "path params:" || lower === "pathparams:") { currentSection = "path"; continue; }
    if (lower === "body:" || lower === "json:" || lower === "json body:") { currentSection = "json"; bodyKind = "json"; continue; }
    if (lower === "form:" || lower === "formdata:" || lower === "form data:") { currentSection = "form"; bodyKind = "formData"; continue; }
    if (lower === "urlencoded:" || lower === "url encoded:") { currentSection = "urlencoded"; bodyKind = "urlEncoded"; continue; }
    if (lower.startsWith("response") || lower.startsWith("success") || lower.startsWith("error")) {
      const statusMatch = line.match(/(\d{3})/);
      const isError = lower.startsWith("error");
      currentResponse = { status: statusMatch ? statusMatch[1] : "200", name: isError ? "error" : "success", fields: [] };
      endpoint.responses.push(currentResponse);
      currentSection = "response";
      continue;
    }

    if (currentSection === "headers" || currentSection === "query" || currentSection === "path") {
      const f = parseFreeField(line);
      if (f) {
        if (currentSection === "headers") endpoint.headers.push(f);
        else if (currentSection === "query") endpoint.queryParams.push(f);
        else if (currentSection === "path") endpoint.pathParams.push(f);
      }
      continue;
    }

    if (currentSection === "json" || currentSection === "form" || currentSection === "urlencoded") {
      const f = parseFreeField(line);
      if (f) bodyFields.push(f);
      continue;
    }

    if (currentSection === "response" && currentResponse) {
      const f = parseFreeField(line);
      if (f) currentResponse.fields.push(f);
      continue;
    }

    if (line.startsWith("- ")) {
      endpoint.conditions.push(line.slice(2).trim());
      continue;
    }

    if (!endpoint.description && line.length > 8) {
      endpoint.description = (endpoint.description ?? "") + (endpoint.description ? " " : "") + line;
    }
  }

  if (bodyFields.length) endpoint.body = { kind: bodyKind ?? "json", fields: bodyFields };

  if (!endpoint.responses.length) {
    endpoint.responses.push({ status: endpoint.method === "POST" ? "201" : "200", name: "success", fields: deriveSuccessFields(endpoint) });
  }

  return renderDsl(endpoint as EndpointSpec);
}

function detectBodyKind(fields: FieldSpec[], current: BodyKind | undefined): BodyKind {
  if (current) return current;
  if (fields.some((field) => field.type === "file")) return "formData";
  return "json";
}

function parseFreeField(line: string): FieldSpec | null {
  const cleaned = line.replace(/^[-*]\s*/, "").replace(/`/g, "");
  if (!cleaned) return null;
  const [namePart, ...rest] = cleaned.split(/\s+/);
  if (!namePart) return null;
  const description = rest.join(" ").replace(/^-\s*/, "").trim();
  const type = inferType(namePart, description);
  return { name: namePart.replace(/:$/, ""), type, required: !description.toLowerCase().includes("optional"), description: description || undefined, validation: {} };
}

function inferType(name: string, hint: string): string {
  const n = name.toLowerCase();
  const h = hint.toLowerCase();
  if (n === "email" || h.includes("email")) return "email";
  if (n.endsWith("_url") || h.includes("url")) return "string";
  if (n.endsWith("_at") || h.includes("date") || h.includes("time")) return "string";
  if (n === "id" || n.endsWith("_id")) return "string";
  if (n.includes("file") || n.includes("avatar") || n.includes("image")) return "file";
  if (n === "page" || n === "limit" || n === "count" || n.includes("amount")) return "integer";
  if (n.includes("is_") || n.startsWith("has_") || h.includes("boolean")) return "boolean";
  return "string";
}

function deriveSuccessFields(endpoint: Partial<EndpointSpec>): FieldSpec[] {
  const fields: FieldSpec[] = [];
  fields.push({ name: "id", type: "string", required: true, description: "Resource ID.", validation: {} });
  if (endpoint.body?.fields.some((field) => field.name === "email")) fields.push({ name: "email", type: "email", required: true, description: "Email user.", validation: {} });
  if (endpoint.body?.fields.some((field) => field.name === "name")) fields.push({ name: "name", type: "string", required: true, description: "Nama resource.", validation: {} });
  return fields;
}

function parseCurlLine(line: string, endpoint: Partial<EndpointSpec> & { responses: ResponseSpec[]; pathParams: FieldSpec[]; queryParams: FieldSpec[]; headers: FieldSpec[] }, bodyFields: FieldSpec[], getKind: () => BodyKind | undefined): void {
  const headerMatches = [...line.matchAll(/-H\s+['"]([^'"]+)['"]/g)];
  for (const match of headerMatches) {
    const [key, ...valueParts] = match[1].split(":");
    const value = valueParts.join(":").trim();
    if (!key) continue;
    endpoint.headers.push({ name: key.trim(), type: "string", required: false, description: value || undefined, validation: {} });
  }
  const dataMatch = line.match(/--data(?:-raw|-binary)?\s+['"]([^'"]+)['"]/);
  if (dataMatch) {
    try {
      const parsed = JSON.parse(dataMatch[1]);
      if (parsed && typeof parsed === "object") {
        for (const [key, value] of Object.entries(parsed)) {
          bodyFields.push({ name: key, type: inferType(key, String(value)), required: true, description: undefined, validation: {} });
        }
      }
    } catch {
      // not JSON, ignore
    }
  }
  const formMatch = [...line.matchAll(/-F\s+['"]([^'"]+)['"]/g)];
  for (const match of formMatch) {
    const [key, value] = match[1].split("=");
    bodyFields.push({ name: key, type: value.startsWith("@") ? "file" : "string", required: true, description: undefined, validation: {} });
  }
}

function renderDsl(endpoint: EndpointSpec): string {
  const lines: string[] = [];
  lines.push(`# ${endpoint.title}`);
  lines.push(`${endpoint.method} ${endpoint.path}`);
  if (endpoint.description) lines.push(`Description: ${endpoint.description}`);
  if (endpoint.headers.length) {
    lines.push("Headers:");
    for (const h of endpoint.headers) lines.push(`${h.name} string required - ${h.description ?? "Header."}`);
  }
  if (endpoint.pathParams.length) {
    lines.push("PathParams:");
    for (const p of endpoint.pathParams) lines.push(`${p.name} string required - ${p.description ?? "Path param."}`);
  }
  if (endpoint.queryParams.length) {
    lines.push("Query:");
    for (const q of endpoint.queryParams) lines.push(`${q.name} string optional - ${q.description ?? "Query param."}`);
  }
  if (endpoint.body) {
    const title = endpoint.body.kind === "formData" ? "FormData" : endpoint.body.kind === "urlEncoded" ? "UrlEncoded" : "Body";
    lines.push(`${title}:`);
    for (const f of endpoint.body.fields) lines.push(`${f.name} ${f.type} required - TODO - jelaskan field.`);
  }
  for (const response of endpoint.responses) {
    lines.push(`${response.name === "error" ? "Error" : "Success"} ${response.status}:`);
    for (const f of response.fields) lines.push(`${f.name} ${f.type} required - ${f.description ?? "Response field."}`);
  }
  if (endpoint.conditions.length) {
    lines.push("Condition:");
    for (const c of endpoint.conditions) lines.push(`- ${c}`);
  }
  return lines.join("\n") + "\n";
}
