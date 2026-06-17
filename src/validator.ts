import type { ApiSpec, EndpointSpec, ValidationIssue } from "./types.js";

export function validateApiSpec(api: ApiSpec): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!api.title) issues.push({ level: "error", message: "API title missing." });
  if (api.endpoints.length === 0) issues.push({ level: "error", message: "No endpoints found." });
  for (const endpoint of api.endpoints) validateEndpoint(endpoint, issues);
  return issues;
}

export function generateReport(api: ApiSpec, issues: ValidationIssue[]): string {
  const totalChecks = Math.max(1, api.endpoints.length * 5);
  const warningPenalty = issues.filter((issue) => issue.level === "warning").length;
  const errorPenalty = issues.filter((issue) => issue.level === "error").length * 2;
  const score = Math.max(0, Math.round(((totalChecks - warningPenalty - errorPenalty) / totalChecks) * 100));
  const lines = ["# AI Documentation Report", "", `Completeness score: ${score}/100`, "", `Endpoints: ${api.endpoints.length}`, "", "## Issues", ""];
  if (issues.length === 0) lines.push("No issues found.");
  for (const issue of issues) lines.push(`- ${issue.level.toUpperCase()}: ${issue.endpoint ? `${issue.endpoint} - ` : ""}${issue.message}`);
  lines.push("", "## AI Next Steps", "", "- Add missing descriptions.", "- Add validation constraints for every input field.", "- Add realistic success and error examples.", "- Confirm auth behavior per endpoint.", "");
  return lines.join("\n");
}

function validateEndpoint(endpoint: EndpointSpec, issues: ValidationIssue[]): void {
  const label = `${endpoint.method} ${endpoint.path}`;
  if (!endpoint.title) issues.push({ level: "warning", endpoint: label, message: "Summary/title missing." });
  if (!endpoint.description) issues.push({ level: "warning", endpoint: label, message: "Description missing." });
  if (endpoint.responses.length === 0) issues.push({ level: "error", endpoint: label, message: "Response examples missing." });
  if (endpoint.body && endpoint.body.fields.some((field) => !field.description)) issues.push({ level: "warning", endpoint: label, message: "Some body fields have no description." });
  if (endpoint.queryParams.some((field) => !field.description)) issues.push({ level: "warning", endpoint: label, message: "Some query params have no description." });
}
