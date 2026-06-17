# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- 23 CLI commands (init, generate, validate, format, scan, bundle, watch, serve, mock, infer, chat, ai-fill, ai-infer, import-postman, export-postman, export-insomnia, export-curl, diff, breaking, lint, coverage, hit, readme, sdk, changelog)
- HTML dashboard with 4 tabs (Overview, Endpoints, Flow, Try It)
- Native HTML/CSS flowchart (no external dependencies)
- Tag filter + search in Endpoints tab
- Mock server from DSL/OpenAPI (zero deps, Node http)
- Postman/Insomnia/cURL export
- TypeScript SDK generator
- LLM provider integration (Anthropic, OpenAI, mock)
- Heuristic DSL inference from notes/curl/JSON
- Interactive REPL DSL builder (`chat` command)
- Best-practice linter (10+ rules)
- Spec diff + breaking change detection
- Endpoint coverage tracker
- Auto-changelog generator
- README generator
- Auto-update via `watch` command
- `.openspecrc.json` config support
- CI/CD via GitHub Actions (build, test, publish, mock smoke test, docs deploy)
- Dependabot for npm + GitHub Actions
