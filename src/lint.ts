import type { ApiSpec, EndpointSpec } from "./types.js";

export type LintIssue = { level: "error" | "warning" | "info"; endpoint?: string; rule: string; message: string };

export function lintSpec(api: ApiSpec): LintIssue[] {
  const issues: LintIssue[] = [];
  for (const endpoint of api.endpoints) {
    const label = `${endpoint.method} ${endpoint.path}`;
    if (!endpoint.description) issues.push({ level: "warning", endpoint: label, rule: "doc-description", message: "Endpoint should have a description." });
    if (endpoint.pathParams.length === 0 && endpoint.path.includes("{")) issues.push({ level: "error", endpoint: label, rule: "path-params", message: "Path has {param} but no PathParams section." });
    if (endpoint.method === "POST" && !endpoint.responses.some((r) => r.status.startsWith("2"))) issues.push({ level: "warning", endpoint: label, rule: "success-response", message: "POST should declare a 2xx success response." });
    if (endpoint.method === "DELETE" && endpoint.responses.length === 0) issues.push({ level: "info", endpoint: label, rule: "delete-response", message: "Consider declaring 204 or 200 response." });
    for (const field of [...endpoint.headers, ...endpoint.pathParams, ...endpoint.queryParams, ...(endpoint.body?.fields ?? [])]) {
      if (!field.description) issues.push({ level: "warning", endpoint: label, rule: "field-description", message: `Field "${field.name}" has no description.` });
    }
    for (const field of endpoint.pathParams) {
      if (!field.required) issues.push({ level: "error", endpoint: label, rule: "path-required", message: `Path param "${field.name}" must be required.` });
    }
    for (const field of endpoint.queryParams) {
      if (field.required && field.validation.enum) issues.push({ level: "info", endpoint: label, rule: "enum-validation", message: `Query param "${field.name}" uses enum, good.` });
    }
    if (endpoint.body?.kind === "formData") {
      const hasFile = endpoint.body.fields.some((f) => f.type === "file");
      const hasSize = endpoint.body.fields.some((f) => f.validation.maxSize);
      if (hasFile && !hasSize) issues.push({ level: "warning", endpoint: label, rule: "file-size", message: "Form-data with file should declare maxSize." });
    }
    if (endpoint.responses.every((r) => r.status === "200")) {
      issues.push({ level: "info", endpoint: label, rule: "error-responses", message: "Consider adding error responses (400, 401, 403, 404, 500)." });
    }
  }
  return issues;
}

export function formatLintReport(issues: LintIssue[]): string {
  const lines: string[] = ["# Lint Report", "", `Total issues: ${issues.length}`, `Errors: ${issues.filter((i) => i.level === "error").length}`, `Warnings: ${issues.filter((i) => i.level === "warning").length}`, `Info: ${issues.filter((i) => i.level === "info").length}`, ""];
  for (const issue of issues) lines.push(`- ${issue.level.toUpperCase()}${issue.endpoint ? ` [${issue.endpoint}]` : ""} (${issue.rule}): ${issue.message}`);
  return lines.join("\n");
}
