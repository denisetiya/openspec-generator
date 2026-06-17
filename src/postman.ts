import type { EndpointSpec } from "./types.js";

type PostmanItem = {
  name?: string;
  request?: {
    method?: string;
    header?: Array<{ key: string; value: string; disabled?: boolean }>;
    url?: {
      raw?: string;
      host?: string[];
      path?: string[];
      query?: Array<{ key: string; value: string; disabled?: boolean }>;
      variable?: Array<{ key: string; value: string }>;
    };
    body?: {
      mode?: string;
      raw?: string;
      formdata?: Array<{ key: string; value?: string; type?: string; src?: string }>;
      urlencoded?: Array<{ key: string; value: string }>;
    };
    auth?: { type?: string; bearer?: Array<{ key: string; value: string }> };
  };
  item?: PostmanItem[];
};

export function postmanToDsl(collection: unknown): string {
  if (!isCollection(collection)) throw new Error("Invalid Postman collection.");
  const info = collection.info ?? { name: "Imported API", schema: "" };
  const endpoints: EndpointSpec[] = [];
  walkItems(collection.item ?? [], endpoints);
  return render({ title: info.name ?? "Imported API", version: collection.info?.version ?? "1.0.0", servers: extractServers(collection.item ?? []), endpoints });
}

function walkItems(items: PostmanItem[], sink: EndpointSpec[]): void {
  for (const item of items) {
    if (item.item) {
      walkItems(item.item, sink);
      continue;
    }
    if (!item.request) continue;
    const request = item.request;
    const method = (request.method ?? "GET").toUpperCase();
    const path = normalizePath(request.url?.raw ?? "/", request.url);
    const headers = (request.header ?? []).filter((header) => !header.disabled).map((header) => ({ name: header.key, type: "string", required: true, description: undefined, validation: {} }));
    const query = (request.url?.query ?? []).filter((q) => !q.disabled).map((q) => ({ name: q.key, type: "string", required: false, description: undefined, validation: {} }));
    const pathParams = extractPathParams(path, request.url?.variable ?? []);
    const body = extractBody(request);
    sink.push({ title: item.name ?? `${method} ${path}`, method: method as EndpointSpec["method"], path, description: undefined, headers, pathParams, queryParams: query, body, dependsOn: [], conditions: [], tags: [], responses: [] });
  }
}

function extractBody(request: NonNullable<PostmanItem["request"]>): EndpointSpec["body"] {
  const body = request.body;
  if (!body) return undefined;
  if (body.mode === "raw" && body.raw) {
    try {
      const parsed = JSON.parse(body.raw);
      if (parsed && typeof parsed === "object") {
        return { kind: "json", fields: Object.entries(parsed).map(([key, value]) => ({ name: key, type: inferType(value), required: false, validation: {} })) };
      }
    } catch {
      return undefined;
    }
  }
  if (body.mode === "formdata") return { kind: "formData", fields: (body.formdata ?? []).map((field) => ({ name: field.key, type: field.type === "file" ? "file" : "string", required: true, validation: {} })) };
  if (body.mode === "urlencoded") return { kind: "urlEncoded", fields: (body.urlencoded ?? []).map((field) => ({ name: field.key, type: "string", required: false, validation: {} })) };
  return undefined;
}

function inferType(value: unknown): string {
  if (typeof value === "number") return Number.isInteger(value) ? "integer" : "number";
  if (typeof value === "boolean") return "boolean";
  if (Array.isArray(value)) return "array";
  if (value && typeof value === "object") return "object";
  return "string";
}

function normalizePath(raw: string, url?: NonNullable<PostmanItem["request"]>["url"]): string {
  if (raw.includes("://")) {
    const url = new URL(raw);
    return url.pathname || "/";
  }
  if (url?.path && url.path.length) return "/" + url.path.join("/");
  return raw || "/";
}

function extractPathParams(path: string, variables: Array<{ key: string; value: string }>): EndpointSpec["pathParams"] {
  const matches = [...path.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]);
  return matches.map((name) => ({ name, type: "string", required: true, description: variables.find((variable) => variable.key === name)?.value, validation: {} }));
}

function extractServers(items: PostmanItem[]): string[] {
  for (const item of items) {
    const raw = item.request?.url?.raw;
    if (raw && raw.includes("://")) {
      try { return [new URL(raw).origin]; } catch { /* noop */ }
    }
    if (item.request?.url?.host) return [item.request.url.host.join(".")];
  }
  return ["https://api.example.com"];
}

function render(meta: { title: string; version: string; servers: string[]; endpoints: EndpointSpec[] }): string {
  const lines = [`API: ${meta.title}`, `Version: ${meta.version}`, `Server: ${meta.servers[0] ?? ""}`, "ApiDescription: Imported from Postman collection.", ""];
  for (const endpoint of meta.endpoints) {
    lines.push(`# ${endpoint.title}`);
    lines.push(`${endpoint.method} ${endpoint.path}`);
    lines.push("Description: TODO - jelaskan endpoint ini.");
    if (endpoint.headers.length) {
      lines.push("Headers:");
      for (const header of endpoint.headers) lines.push(`${header.name} string required - ${header.description ?? "Header."}`);
    }
    if (endpoint.pathParams.length) {
      lines.push("PathParams:");
      for (const pathParam of endpoint.pathParams) lines.push(`${pathParam.name} string required - ${pathParam.description ?? "Path param."}`);
    }
    if (endpoint.queryParams.length) {
      lines.push("Query:");
      for (const queryParam of endpoint.queryParams) lines.push(`${queryParam.name} string optional - ${queryParam.description ?? "Query param."}`);
    }
    if (endpoint.body) {
      const title = endpoint.body.kind === "formData" ? "FormData" : endpoint.body.kind === "urlEncoded" ? "UrlEncoded" : "Body";
      lines.push(`${title}:`);
      for (const field of endpoint.body.fields) lines.push(`${field.name} ${field.type} required - TODO - deskripsi field.`);
    }
    lines.push("Success 200:");
    lines.push("data object required - Response payload.");
    lines.push("");
  }
  return lines.join("\n");
}

function isCollection(value: unknown): value is { info?: { name?: string; version?: string }; item?: PostmanItem[] } {
  return typeof value === "object" && value !== null;
}
