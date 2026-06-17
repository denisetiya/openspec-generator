// @ts-check
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const out = execSync("node dist/cli.js lint examples/simple-api.md", { encoding: "utf8" });
if (!out.includes("Total issues:")) throw new Error("lint output invalid");
if (!existsSync("dist/cli.js")) throw new Error("dist/cli.js missing");
const v = execSync("node dist/cli.js version", { encoding: "utf8" }).trim();
if (!/^\d+\.\d+\.\d+$/.test(v)) throw new Error("version invalid: " + v);

const pkg = JSON.parse(readFileSync("package.json", "utf8"));

if (process.env.PUBLISH_DRY_RUN === "true" || process.argv.includes("--dry-run")) {
  console.log("=== PUBLISH DRY RUN ===");
  console.log(`Name: ${pkg.name}`);
  console.log(`Version: ${pkg.version}`);
  console.log(`Bin: ${JSON.stringify(pkg.bin)}`);
  console.log(`Files: ${(pkg.files || []).join(", ")}`);
  console.log(`Engines: ${JSON.stringify(pkg.engines)}`);
  console.log("");
  console.log("--- npm pack dry-run ---");
  console.log(execSync("npm pack --dry-run", { encoding: "utf8" }));
  console.log("");
  console.log("✅ Dry run complete. No publish performed.");
  process.exit(0);
}

console.log("smoke test passed (version=" + v + ")");
