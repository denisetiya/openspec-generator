import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import YAML from "yaml";
import { fromOpenApi } from "./openapi.js";
import { parseApiSpec } from "./parser.js";
import type { ApiSpec, EndpointSpec, FieldSpec, ResponseSpec } from "./types.js";

export async function startMockServer(specPath: string, port: number, corsOrigin: string): Promise<void> {
  const api = await loadSpecFromPath(specPath);
  const server = createServer((req, res) => {
    setCors(res, corsOrigin);
    if (req.method === "OPTIONS") { res.statusCode = 204; res.end(); return; }
    if (req.url === "/" || req.url === "/_spec") { res.setHeader("content-type", "application/json"); res.end(JSON.stringify(api, null, 2)); return; }
    if (req.url === "/openapi.yaml") { res.setHeader("content-type", "text/yaml"); res.end(YAML.stringify(JSON.parse(JSON.stringify(api)))); return; }
    const match = findMatch(api, req.method ?? "GET", req.url ?? "/");
    if (!match) { res.statusCode = 404; res.setHeader("content-type", "application/json"); res.end(JSON.stringify({ error: "Not found", method: req.method, url: req.url }, null, 2)); return; }
    const response = match.responses[0] ?? { status: "200", name: "success", fields: [] };
    const status = Number(response.status) || 200;
    res.statusCode = status;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(buildExample(response.fields), null, 2));
  });
  server.listen(port, () => {
    console.log(`Mock server: http://localhost:${port}`);
    console.log(`Spec at:    http://localhost:${port}/_spec`);
    console.log(`OpenAPI at: http://localhost:${port}/openapi.yaml`);
    console.log("Press Ctrl+C to stop.");
  });
}

async function loadSpecFromPath(path: string): Promise<ApiSpec> {
  const text = await readFile(resolve(path), "utf8");
  if (path.endsWith(".yaml") || path.endsWith(".yml")) {
    try {
      const parsed = YAML.parse(text);
      if (parsed?.openapi || parsed?.swagger) return fromOpenApi(JSON.stringify(parsed));
    } catch {}
  }
  return parseApiSpec(text);
}

function findMatch(api: ApiSpec, method: string, url: string): EndpointSpec | null {
  const [path] = url.split("?");
  for (const endpoint of api.endpoints) {
    if (endpoint.method !== method.toUpperCase()) continue;
    if (matchPath(endpoint.path, path)) return endpoint;
  }
  return null;
}

function matchPath(template: string, actual: string): boolean {
  const tParts = template.split("/");
  const aParts = actual.split("/");
  if (tParts.length !== aParts.length) return false;
  for (let i = 0; i < tParts.length; i++) {
    if (tParts[i].startsWith("{")) continue;
    if (tParts[i] !== aParts[i]) return false;
  }
  return true;
}

function buildExample(fields: FieldSpec[]): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const f of fields) {
    if (f.type === "integer") obj[f.name] = randomInt(1, 1000);
    else if (f.type === "number") obj[f.name] = Math.round(Math.random() * 1000) / 100;
    else if (f.type === "boolean") obj[f.name] = Math.random() > 0.5;
    else if (f.type === "object") obj[f.name] = {};
    else if (f.type === "array") obj[f.name] = [];
    else if (f.type === "email") obj[f.name] = `user${randomInt(1, 999)}@example.com`;
    else if (f.type === "file") obj[f.name] = null;
    else if (f.name === "id" || f.name.endsWith("_id")) obj[f.name] = `id_${randomInt(1000, 9999)}`;
    else if (f.name.endsWith("_url")) obj[f.name] = `https://example.com/${f.name}`;
    else if (f.name.endsWith("_at")) obj[f.name] = new Date().toISOString();
    else obj[f.name] = `${f.name}_${randomInt(1, 999)}`;
  }
  return obj;
}

function randomInt(min: number, max: number): number { return Math.floor(Math.random() * (max - min + 1)) + min; }

function setCors(res: import("node:http").ServerResponse, origin: string): void {
  res.setHeader("access-control-allow-origin", origin);
  res.setHeader("access-control-allow-methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader("access-control-allow-headers", "Content-Type,Authorization");
}
