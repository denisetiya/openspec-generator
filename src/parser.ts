import type { ApiSpec, BodyKind, EndpointSpec, FieldSpec, HttpMethod, ResponseSpec } from "./types.js";

const METHOD_RE = /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(.+)$/i;
const SECTION_NAMES = new Set([
  "description",
  "auth",
  "headers",
  "pathparams",
  "query",
  "queryparams",
  "body",
  "jsonbody",
  "formdata",
  "urlencoded",
  "flow",
  "dependson",
  "conditions",
  "condition",
  "tags",
  "tag",
 ]);

export function parseApiSpec(input: string): ApiSpec {
  const lines = input.replace(/\r\n/g, "\n").split("\n");
  const api: ApiSpec = { title: "Generated API", version: "1.0.0", servers: [], endpoints: [] };
  let current: EndpointSpec | undefined;
  let section = "";
  let currentResponse: ResponseSpec | undefined;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line === "---") continue;

    if (line.startsWith("API:")) {
      api.title = valueAfterColon(line);
      continue;
    }
    if (line.startsWith("Version:")) {
      api.version = valueAfterColon(line);
      continue;
    }
    if (line.startsWith("Server:")) {
      api.servers.push(valueAfterColon(line));
      continue;
    }
    if (line.startsWith("ApiDescription:")) {
      api.description = valueAfterColon(line);
      continue;
    }

    if (line.startsWith("# ")) {
      current = makeEndpoint(line.slice(2).trim());
      api.endpoints.push(current);
      section = "";
      currentResponse = undefined;
      continue;
    }

    const methodMatch = line.match(METHOD_RE);
    if (methodMatch) {
      if (!current) {
        current = makeEndpoint(`${methodMatch[1].toUpperCase()} ${methodMatch[2]}`);
        api.endpoints.push(current);
      }
      current.method = methodMatch[1].toUpperCase() as HttpMethod;
      current.path = methodMatch[2].trim();
      continue;
    }

    if (!current) continue;

    const label = line.endsWith(":") ? line.slice(0, -1).replace(/\s+/g, "").toLowerCase() : "";
    if (SECTION_NAMES.has(label)) {
      section = label;
      currentResponse = undefined;
      setBodyKind(current, label);
      continue;
    }

    const responseMatch = line.match(/^(Success|Error)\s+(\d{3}):$/i);
    if (responseMatch) {
      currentResponse = { status: responseMatch[2], name: responseMatch[1].toLowerCase(), fields: [] };
      current.responses.push(currentResponse);
      section = "response";
      continue;
    }

    if (line.startsWith("Description:")) {
      current.description = valueAfterColon(line);
      continue;
    }
    if (line.startsWith("Auth:")) {
      current.auth = valueAfterColon(line);
      continue;
    }
    if (line.startsWith("Flow:")) {
      current.flow = valueAfterColon(line);
      continue;
    }
    if (line.startsWith("DependsOn:")) {
      current.dependsOn.push(...splitList(valueAfterColon(line)));
      continue;
    }
    if (line.startsWith("Tags:")) {
      current.tags.push(...splitList(valueAfterColon(line)));
      continue;
    }
    if (line.startsWith("Tag:")) {
      current.tags.push(valueAfterColon(line));
      continue;
    }
    if (line.startsWith("Condition:")) {
      current.conditions.push(valueAfterColon(line));
      continue;
    }

    if (section === "description") {
      current.description = appendText(current.description, line);
      continue;
    }
    if (section === "auth") {
      current.auth = appendText(current.auth, line);
      continue;
    }
    if (section === "flow") {
      current.flow = appendText(current.flow, line);
      continue;
    }
    if (section === "dependson") {
      current.dependsOn.push(...splitList(line));
      continue;
    }
    if (section === "tags" || section === "tag") {
      current.tags.push(...splitList(line));
      continue;
    }
    if (section === "conditions" || section === "condition") {
      current.conditions.push(line.replace(/^-\s*/, ""));
      continue;
    }
    if (section === "headers") current.headers.push(parseField(line, true));
    if (section === "pathparams") current.pathParams.push(parseField(line, true));
    if (section === "query" || section === "queryparams") current.queryParams.push(parseField(line, false));
    if (["body", "jsonbody", "formdata", "urlencoded"].includes(section)) current.body?.fields.push(parseField(line, false));
    if (section === "response" && currentResponse) currentResponse.fields.push(parseField(line, true));
  }

  if (api.servers.length === 0) api.servers.push("https://api.example.com");
  return api;
}

function makeEndpoint(title: string): EndpointSpec {
  return {
    title,
    method: "GET",
    path: "/",
    headers: [],
    pathParams: [],
    queryParams: [],
    dependsOn: [],
    conditions: [],
    tags: [],
    responses: [],
  };
}

function setBodyKind(endpoint: EndpointSpec, label: string): void {
  const kindByLabel: Record<string, BodyKind | undefined> = {
    body: "json",
    jsonbody: "json",
    formdata: "formData",
    urlencoded: "urlEncoded",
  };
  const kind = kindByLabel[label];
  if (kind) endpoint.body = { kind, fields: [] };
}

function parseField(line: string, defaultRequired: boolean): FieldSpec {
  const [left, description] = line.split(/\s+-\s+/, 2);
  const tokens = left.split(/\s+/).filter(Boolean);
  const name = tokens.shift() ?? "field";
  const type = tokens.shift() ?? "string";
  let required = defaultRequired;
  const validation: FieldSpec["validation"] = {};

  for (const token of tokens) {
    if (token === "required") required = true;
    else if (token === "optional") required = false;
    else if (token === "nullable") validation.nullable = true;
    else if (token.includes("=")) {
      const [key, rawValue] = token.split("=", 2);
      validation[key] = coerceValue(rawValue);
    }
  }

  return { name: name.replace(/:$/, ""), type, required, description, validation };
}

function coerceValue(value: string): string | number | boolean {
  if (value === "true") return true;
  if (value === "false") return false;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && value.trim() !== "" ? numberValue : value;
}

function valueAfterColon(line: string): string {
  return line.slice(line.indexOf(":") + 1).trim();
}

function appendText(existing: string | undefined, next: string): string {
  return existing ? `${existing} ${next}` : next;
}

function splitList(value: string): string[] {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}
