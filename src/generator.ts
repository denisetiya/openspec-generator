import YAML from "yaml";
import type { ApiSpec, BodySpec, EndpointSpec, FieldSpec, ResponseSpec } from "./types.js";

export function generateOpenApiYaml(api: ApiSpec): string {
  return YAML.stringify(generateOpenApi(api), { lineWidth: 120 });
}

export function generateOpenApi(api: ApiSpec): Record<string, unknown> {
  const paths: Record<string, Record<string, unknown>> = {};

  for (const endpoint of api.endpoints) {
    paths[endpoint.path] ??= {};
    paths[endpoint.path][endpoint.method.toLowerCase()] = buildOperation(endpoint);
  }

  return {
    openapi: "3.1.0",
    info: {
      title: api.title,
      version: api.version,
      ...(api.description ? { description: api.description } : {}),
    },
    servers: api.servers.map((url) => ({ url })),
    paths,
  };
}

function buildOperation(endpoint: EndpointSpec): Record<string, unknown> {
  return {
    summary: endpoint.title,
    description: endpoint.description ?? endpoint.title,
    ...(endpoint.auth ? { security: [{ bearerAuth: [] }] } : {}),
    parameters: [...endpoint.pathParams.map((field) => parameter(field, "path")), ...endpoint.queryParams.map((field) => parameter(field, "query")), ...endpoint.headers.map((field) => parameter(field, "header"))],
    ...(endpoint.body ? { requestBody: requestBody(endpoint.body) } : {}),
    responses: Object.fromEntries(endpoint.responses.map((response) => [response.status, responseBody(response)])),
  };
}

function parameter(field: FieldSpec, location: "path" | "query" | "header"): Record<string, unknown> {
  return {
    name: field.name,
    in: location,
    required: location === "path" ? true : field.required,
    description: field.description ?? `${field.name} parameter.`,
    schema: schemaFor(field),
  };
}

function requestBody(body: BodySpec): Record<string, unknown> {
  const contentType = body.kind === "formData" ? "multipart/form-data" : body.kind === "urlEncoded" ? "application/x-www-form-urlencoded" : "application/json";
  return {
    required: body.fields.some((field) => field.required),
    content: {
      [contentType]: {
        schema: objectSchema(body.fields),
        example: exampleObject(body.fields),
      },
    },
  };
}

function responseBody(response: ResponseSpec): Record<string, unknown> {
  return {
    description: response.name === "success" ? "Successful response." : "Error response.",
    content: {
      "application/json": {
        schema: objectSchema(response.fields),
        example: exampleObject(response.fields),
      },
    },
  };
}

function objectSchema(fields: FieldSpec[]): Record<string, unknown> {
  return {
    type: "object",
    required: fields.filter((field) => field.required).map((field) => field.name),
    properties: Object.fromEntries(fields.map((field) => [field.name, schemaFor(field)])),
  };
}

function schemaFor(field: FieldSpec): Record<string, unknown> {
  const schema: Record<string, unknown> = { type: normalizeType(field.type) };
  if (field.type === "file") {
    schema.type = "string";
    schema.format = "binary";
  }
  if (field.type === "email") {
    schema.type = "string";
    schema.format = "email";
  }
  if (field.description) schema.description = field.description;
  for (const [key, value] of Object.entries(field.validation)) {
    if (key === "nullable") schema.nullable = value;
    else if (key === "enum" && typeof value === "string") schema.enum = value.split("|");
    else schema[key] = value;
  }
  return schema;
}

function normalizeType(type: string): string {
  if (["integer", "number", "boolean", "object", "array"].includes(type)) return type;
  return "string";
}

function exampleObject(fields: FieldSpec[]): Record<string, unknown> {
  return Object.fromEntries(fields.map((field) => [field.name, exampleValue(field)]));
}

function exampleValue(field: FieldSpec): unknown {
  if (field.validation.enum && typeof field.validation.enum === "string") return field.validation.enum.split("|")[0];
  if (field.type === "integer") return 1;
  if (field.type === "number") return 1.5;
  if (field.type === "boolean") return true;
  if (field.type === "object") return {};
  if (field.type === "array") return [];
  if (field.type === "email") return "user@example.com";
  if (field.type === "file") return "binary-file";
  if (field.name.endsWith("_url")) return "https://example.com/file.png";
  if (field.name === "id" || field.name.endsWith("_id")) return "id_123";
  return `${field.name}_value`;
}
