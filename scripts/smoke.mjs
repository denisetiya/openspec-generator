// @ts-check
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

const out = execSync("node dist/cli.js lint examples/simple-api.md", { encoding: "utf8" });
if (!out.includes("Total issues:")) throw new Error("lint output invalid");
if (!existsSync("dist/cli.js")) throw new Error("dist/cli.js missing");
const v = execSync("node dist/cli.js version", { encoding: "utf8" }).trim();
if (!/^\d+\.\d+\.\d+$/.test(v)) throw new Error("version invalid: " + v);
console.log("smoke test passed (version=" + v + ")");
