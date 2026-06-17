export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";

export type BodyKind = "json" | "formData" | "urlEncoded";

export type FieldLocation = "path" | "query" | "header" | "body" | "response";

export type FieldSpec = {
  name: string;
  type: string;
  required: boolean;
  description?: string;
  validation: Record<string, string | number | boolean>;
};

export type BodySpec = {
  kind: BodyKind;
  fields: FieldSpec[];
};

export type ResponseSpec = {
  status: string;
  name: string;
  fields: FieldSpec[];
};

export type EndpointSpec = {
  title: string;
  method: HttpMethod;
  path: string;
  description?: string;
  auth?: string;
  flow?: string;
  dependsOn: string[];
  conditions: string[];
  tags: string[];
  headers: FieldSpec[];
  pathParams: FieldSpec[];
  queryParams: FieldSpec[];
  body?: BodySpec;
  responses: ResponseSpec[];
};

export type ApiSpec = {
  title: string;
  version: string;
  description?: string;
  servers: string[];
  endpoints: EndpointSpec[];
};

export type ValidationIssue = {
  level: "error" | "warning";
  endpoint?: string;
  message: string;
};
