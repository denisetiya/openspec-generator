# OpenSpec Generator v0.2.0

AI-friendly Markdown DSL → OpenAPI 3.1 + readable docs + HTML dashboard with live Try It + mock server + SDK generator + diff + lint + coverage.

Designed so AI (and humans) can write API schemas without touching raw OpenAPI. The CLI scans, validates, exports, and auto-updates docs.

## Install (dev / local)

```bash
npm install
npm run build
```

## Install from npm (after publish)

```bash
npm install -D openspec-generator
```

## Quick start

```bash
npx openspec-generator init my-api
cd my-api
npx openspec-generator generate api.md --out output
npx openspec-generator serve --port 4321 --dir output
```

## All commands

### Core
| Command | Purpose |
| --- | --- |
| `init [path]` | Scaffold `api.md` + AI prompt |
| `generate [file\|dir] --out <dir>` | Build openapi.yaml, api-docs.md, dashboard.html, ai-report.md |
| `validate [file\|dir]` | Check completeness, exit 1 on errors |
| `format [file\|dir] [--write]` | Format DSL to stdout or file |
| `scan [dir] --out <dir> [--watch]` | Scan folder of DSL files, optionally watch |
| `bundle <a> <b> ... --out <dir>` | Merge multiple DSL files |
| `watch <file\|dir> --out <dir>` | Regenerate on file change |
| `serve --port 4321 --dir output` | Serve generated dashboard |

### Import / Export
| Command | Purpose |
| --- | --- |
| `import-postman <file> --out <md>` | Convert Postman v2.1 → DSL |
| `export-postman --out <json>` | DSL → Postman collection |
| `export-insomnia --out <json>` | DSL → Insomnia v4 export |
| `export-curl --out <sh>` | DSL → cURL snippets |

### AI
| Command | Purpose |
| --- | --- |
| `infer <notes> --out <dsl>` | Heuristic DSL from free-form notes/curl/JSON |
| `chat [target]` | Interactive REPL DSL builder |
| `ai-fill <dsl> --out <dsl>` | Use LLM to fill missing fields |
| `ai-infer <notes> --out <dsl>` | Use LLM to convert notes to DSL |

AI options:
```bash
--provider <anthropic|openai|mock>   (default: mock)
--api-key <key>                       (or set ANTHROPIC_API_KEY / OPENAI_API_KEY)
--model <model>                       (default: claude-3-5-sonnet / gpt-4o)
```

### Server & Testing
| Command | Purpose |
| --- | --- |
| `mock <spec> --port 3000` | Run mock server from spec (returns realistic JSON) |
| `diff <old> <new> --out <md>` | Compare two specs, show changes |
| `breaking <old> <new>` | Show only breaking changes, exit 1 |
| `lint <file> --out <md>` | Best-practice checker (10+ rules) |
| `coverage <file> --out <md>` | Endpoint coverage report |
| `hit <METHOD> <path>` | Record endpoint hit for coverage |

### Generation
| Command | Purpose |
| --- | --- |
| `readme <file> --out <md>` | Generate README.md with table of endpoints |
| `sdk <file> --out <ts>` | Generate TypeScript SDK class |
| `changelog <old> <new> --version <v>` | Generate changelog from diff |

### OpenAPI round-trip
```bash
# OpenAPI → DSL (read existing spec)
npx openspec-generator from-openapi openapi.yaml --out api.md   # via import-postman for Postman

# DSL → OpenAPI
npx openspec-generator generate api.md --out output   # produces openapi.yaml
```

## Config (`.openspecrc.json`)

Optional config file in project root. CLI flags override config.

```json
{
  "schemaFile": "api.md",
  "schemaDir": "schemas",
  "output": "docs/api",
  "watch": true,
  "port": 4321
}
```

- `schemaFile` — single DSL file when no args given.
- `schemaDir` — directory of `.md` / `.yaml` / `.json` schemas to scan.
- `output` — default output directory.
- `watch` — when true, `scan` watches the directory and regenerates on save.
- `port` — port for `serve` command.

## Dev loop (auto-update)

```bash
# Terminal 1: watch folder of DSL files
npx openspec-generator watch schemas --out output

# Terminal 2: serve dashboard
npx openspec-generator serve --port 4321 --dir output
```

Edit DSL → output auto-regenerates → refresh browser.

## AI DSL cheatsheet

```md
API: <name>
Version: <semver>
Server: <base url>
ApiDescription: <description>

# <Endpoint Title>
<METHOD> <PATH>
Description: <what it does>
Auth: Bearer token
Tags: <tag1, tag2>
DependsOn: <other endpoint>
Flow: <process flow>
Condition:
- <business rule>

PathParams:
id string required - ID resource.

Query:
page integer optional minimum=1 - Halaman.

Headers:
Authorization string required - Bearer token.

Body:
email email required - Email user.

FormData:
avatar file required maxSize=2MB contentType=image/* - Avatar image.

Success 200:
id string required - ID resource.

Error 400:
message string required - Pesan error.
```

## HTML Dashboard

Open `output/dashboard.html` or serve via `openspec-generator serve`.

Features:
- 4 tabs: Overview, Endpoints, Flow, Try It
- Sidebar endpoint list (Postman-style)
- **Tag filter bar** + **search input** in Endpoints tab
- **Native HTML/CSS flowchart** (no CDN, fully offline)
- **Try It**: live request, path/query/header/body builders, JSON / form-data / url-encoded support, file upload, response viewer
- Dark glassmorphism UI, responsive, fully offline (no external dependencies)

## Why this is AI-friendly

- DSL is a tiny subset of Markdown, easy for LLMs to emit.
- No need to write OpenAPI YAML, JSON Schema, or HTML.
- Validator reports exactly which fields are missing or weak.
- `format` normalizes AI output to consistent style.
- `import-postman` lets AI start from real collections.
- `ai-fill` and `ai-infer` use real LLM providers (Anthropic, OpenAI) with `--provider mock` for offline testing.
- `infer` uses heuristics to bootstrap DSL from free-form notes/curl/JSON.

## Dev scripts

```bash
npm run build      # tsc → dist/
npm run dev        # tsx src/cli.ts examples/simple-api.md --out output
npm run sample     # npm run build && node dist/cli.js scan examples --out output
```

## Publish

```bash
npm login
npm publish --access public
```

`files` in `package.json` ships only `dist/`, `README.md`, `prompts/`, `examples/`. `prepublishOnly` builds TS first.

## CI/CD (GitHub Actions)

Workflows in `.github/workflows/`:

| File | Trigger | Purpose |
| --- | --- | --- |
| `ci.yml` | push, PR | Build, type-check, lint, validate, test all commands, verify dashboard integrity, upload artifacts. Runs on Node 22 + 24. |
| `publish.yml` | tag `v*.*.*`, manual | Verify version, check registry conflict, publish to npm with provenance, create GitHub release. |
| `docs.yml` | push main | Build dashboard + README, deploy to GitHub Pages. |
| `smoke.yml` | push, PR | Start mock server, hit endpoints with curl, verify JSON responses. |


### Local CI parity

```bash
npm run test:all    # lint + validate + smoke
```

## Project structure

```txt
openspec-generator/
  package.json
  tsconfig.json
  .openspecrc.example.json
  README.md
  examples/
    simple-api.md
  prompts/
    ai-api-doc-prompt.md
    endpoint-template.md
  src/
    cli.ts
    commands.ts        # all subcommands
    config.ts          # .openspecrc.json
    parser.ts          # DSL → ApiSpec
    generator.ts       # OpenAPI YAML
    html.ts            # dashboard
    markdown.ts        # api-docs.md
    validator.ts       # completeness report
    lint.ts            # best-practice rules
    diff.ts            # spec comparison
    breaking.ts        # breaking changes
    mock.ts            # mock server
    export.ts          # Postman/Insomnia/curl
    sdk.ts             # TypeScript SDK
    readme.ts          # README.md generator
    changelog.ts       # changelog generator
    coverage.ts        # endpoint coverage
    infer.ts           # heuristic DSL inference
    chat.ts            # interactive REPL
    llm.ts             # AI provider integration
    postman.ts         # Postman import
    openapi.ts         # OpenAPI loader
    format.ts          # DSL formatter
    init.ts            # project scaffolder
    scan.ts            # folder scan
    types.ts
  output/              # generated
```

## License

MIT
