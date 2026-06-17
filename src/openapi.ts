import type { ApiSpec, EndpointSpec, FieldSpec, ResponseSpec } from "./types.js";

type OpenApi = {
  openapi?: string;
  info?: { title?: string; version?: string; description?: string };
  servers?: Array<{ url: string }>;
  paths?: Record<string, Record<string, OpenApiOperation>>;
};

type OpenApiOperation = {
  summary?: string;
  description?: string;
  operationId?: string;
  tags?: string[];
  parameters?: OpenApiParameter[];
  requestBody?: OpenApiRequestBody;
  responses?: Record<string, OpenApiResponse>;
  security?: Array<Record<string, string[]>>;
};

type OpenApiParameter = {
  name: string;
  in: "path" | "query" | "header" | "cookie";
  required?: boolean;
  description?: string;
  schema?: OpenApiSchema;
};

type OpenApiRequestBody = {
  content?: Record<string, { schema?: OpenApiSchema; example?: unknown }>;
};

type OpenApiResponse = {
  description?: string;
  content?: Record<string, { schema?: OpenApiSchema; example?: unknown }>;
};

type OpenApiSchema = {
  type?: string;
  format?: string;
  enum?: string[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  properties?: Record<string, OpenApiSchema>;
  required?: string[];
  items?: OpenApiSchema;
  description?: string;
};

export function fromOpenApi(yaml: string): ApiSpec {
  const parsed = JSON.parse(JSON.stringify(parseYaml(yaml))) as OpenApi;
  const api: ApiSpec = {
    title: parsed.info?.title ?? "Imported API",
    version: parsed.info?.version ?? "1.0.0",
    description: parsed.info?.description,
    servers: (parsed.servers ?? []).map((server) => server.url),
    endpoints: [],
  };
  for (const [path, methods] of Object.entries(parsed.paths ?? {})) {
    for (const [method, op] of Object.entries(methods)) {
      if (!op || typeof op !== "object") continue;
      const httpMethod = method.toUpperCase() as EndpointSpec["method"];
      const endpoint: EndpointSpec = {
        title: op.summary ?? op.operationId ?? `${httpMethod} ${path}`,
        method: httpMethod,
        path,
        description: op.description,
        headers: [],
        pathParams: [],
        queryParams: [],
        dependsOn: [],
        conditions: [],
        tags: op.tags ?? [],
        responses: [],
      };
      for (const param of op.parameters ?? []) {
        const field = toField(param.name, param.schema, param.description, param.required ?? false);
        if (param.in === "path") endpoint.pathParams.push(field);
        else if (param.in === "query") endpoint.queryParams.push({ ...field, required: param.required ?? false });
        else if (param.in === "header") endpoint.headers.push(field);
      }
      if (op.requestBody?.content) {
        const [contentType, content] = Object.entries(op.requestBody.content)[0] ?? [];
        if (content?.schema) {
          const kind = contentType === "multipart/form-data" ? "formData" : contentType === "application/x-www-form-urlencoded" ? "urlEncoded" : "json";
          endpoint.body = { kind, fields: schemaToFields(content.schema) };
        }
      }
      for (const [status, response] of Object.entries(op.responses ?? {})) {
        const fields: FieldSpec[] = [];
        const [_, body] = Object.entries(response.content ?? {})[0] ?? [];
        if (body?.schema) fields.push(...schemaToFields(body.schema));
        endpoint.responses.push({ status, name: status.startsWith("2") ? "success" : "error", fields });
      }
      api.endpoints.push(endpoint);
    }
  }
  return api;
}

function toField(name: string, schema: OpenApiSchema | undefined, description: string | undefined, required: boolean): FieldSpec {
  return { name, type: mapType(schema), required, description, validation: extractValidation(schema) };
}

function schemaToFields(schema: OpenApiSchema): FieldSpec[] {
  if (schema.type === "object" && schema.properties) {
    return Object.entries(schema.properties).map(([key, value]) => ({ name: key, type: mapType(value), required: schema.required?.includes(key) ?? false, description: value.description, validation: extractValidation(value) }));
  }
  return [];
}

function mapType(schema?: OpenApiSchema): string {
  if (!schema) return "string";
  if (schema.type === "integer" || schema.type === "number") return schema.type;
  if (schema.type === "boolean") return "boolean";
  if (schema.type === "array" || schema.type === "object") return schema.type;
  if (schema.format === "binary") return "file";
  if (schema.format === "email") return "email";
  return "string";
}

function extractValidation(schema?: OpenApiSchema): Record<string, string | number | boolean> {
  if (!schema) return {};
  const v: Record<string, string | number | boolean> = {};
  if (schema.minimum !== undefined) v.minimum = schema.minimum;
  if (schema.maximum !== undefined) v.maximum = schema.maximum;
  if (schema.minLength !== undefined) v.minLength = schema.minLength;
  if (schema.maxLength !== undefined) v.maxLength = schema.maxLength;
  if (schema.enum) v.enum = schema.enum.join("|");
  if (schema.format && schema.format !== "binary" && schema.format !== "email") v.format = schema.format;
  return v;
}

function parseYaml(yaml: string): unknown {
  // Simple YAML parser for OpenAPI - handles basic key:value, lists, nested objects
  // For complex YAML, we'd need a real parser, but this works for our use case
  try {
    // Try JSON first (in case it's already JSON)
    return JSON.parse(yaml);
  } catch {
    // Fall back to a simple YAML parser using the yaml package
    const YAML = require("yaml");
    return YAML.parse(yaml);
  }
}
