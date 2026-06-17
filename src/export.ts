import type { ApiSpec, EndpointSpec, FieldSpec } from "./types.js";

export function toPostman(api: ApiSpec): unknown {
  return {
    info: { name: api.title, schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json" },
    item: api.endpoints.map((endpoint) => toPostmanItem(endpoint, api.servers[0] ?? "")),
  };
}

function toPostmanItem(endpoint: EndpointSpec, baseUrl: string): unknown {
  const url = endpoint.path;
  const request: Record<string, unknown> = { method: endpoint.method, header: endpoint.headers.map((h) => ({ key: h.name, value: h.description ?? "" })), url: { raw: baseUrl + url, host: [baseUrl], path: url.split("/").filter(Boolean) }, description: endpoint.description };
  if (endpoint.body) {
    if (endpoint.body.kind === "json") request.body = { mode: "raw", raw: JSON.stringify(buildExample(endpoint.body.fields), null, 2), options: { raw: { language: "json" } } };
    else if (endpoint.body.kind === "formData") request.body = { mode: "formdata", formdata: endpoint.body.fields.map((f) => ({ key: f.name, type: f.type === "file" ? "file" : "text", value: f.description ?? "" })) };
    else if (endpoint.body.kind === "urlEncoded") request.body = { mode: "urlencoded", urlencoded: endpoint.body.fields.map((f) => ({ key: f.name, value: f.description ?? "" })) };
  }
  return { name: endpoint.title, request };
}

export function toInsomnia(api: ApiSpec): unknown {
  return {
    _type: "export",
    __export_format: 4,
    resources: api.endpoints.flatMap((endpoint) => insomiaResources(endpoint, api)),
  };
}

function insomiaResources(endpoint: EndpointSpec, api: ApiSpec): unknown[] {
  const baseId = `_fld_${api.title}_${endpoint.path}`.replace(/[^a-z0-9_]/gi, "_");
  const reqId = `${baseId}_req`;
  const resources: unknown[] = [{ _id: baseId, _type: "request_group", parentId: "wrk_base", name: endpoint.title }];
  for (const response of endpoint.responses) {
    resources.push({ _id: `${baseId}_resp_${response.status}`, _type: "response", parentId: reqId, name: `${response.name} ${response.status}`, statusCode: Number(response.status), body: JSON.stringify(buildExample(response.fields), null, 2) });
  }
  resources.push({ _id: reqId, _type: "request", parentId: baseId, name: endpoint.title, method: endpoint.method, url: (api.servers[0] ?? "") + endpoint.path, body: endpoint.body ? { mimeType: endpoint.body.kind === "formData" ? "multipart/form-data" : endpoint.body.kind === "urlEncoded" ? "application/x-www-form-urlencoded" : "application/json", text: endpoint.body.kind === "json" ? JSON.stringify(buildExample(endpoint.body.fields), null, 2) : "" } : {} });
  return resources;
}

export function toCurl(api: ApiSpec): string {
  const lines: string[] = [`# ${api.title} - cURL snippets`, ""];
  for (const endpoint of api.endpoints) {
    lines.push(`## ${endpoint.title}`);
    lines.push(`# ${endpoint.method} ${endpoint.path}`);
    let cmd = `curl -X ${endpoint.method} "${api.servers[0] ?? ""}${endpoint.path}"`;
    for (const h of endpoint.headers) cmd += ` \\\n  -H "${h.name}: ${h.description ?? "<value>"}"`;
    if (endpoint.body?.kind === "json") {
      const example = buildExample(endpoint.body.fields);
      cmd += ` \\\n  -H "Content-Type: application/json"`;
      cmd += ` \\\n  -d '${JSON.stringify(example)}'`;
    } else if (endpoint.body?.kind === "formData") {
      for (const f of endpoint.body.fields) cmd += ` \\\n  -F "${f.name}=${f.type === "file" ? "@/path/to/file" : "<value>"}"`;
    } else if (endpoint.body?.kind === "urlEncoded") {
      for (const f of endpoint.body.fields) cmd += ` \\\n  --data-urlencode "${f.name}=<value>"`;
    }
    lines.push(cmd);
    lines.push("");
  }
  return lines.join("\n");
}

function buildExample(fields: FieldSpec[]): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const f of fields) {
    if (f.type === "integer") obj[f.name] = 1;
    else if (f.type === "number") obj[f.name] = 1.5;
    else if (f.type === "boolean") obj[f.name] = true;
    else if (f.type === "object") obj[f.name] = {};
    else if (f.type === "array") obj[f.name] = [];
    else if (f.type === "email") obj[f.name] = "user@example.com";
    else if (f.type === "file") obj[f.name] = null;
    else obj[f.name] = f.name + "_value";
  }
  return obj;
}
