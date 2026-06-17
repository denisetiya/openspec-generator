#!/usr/bin/env node
import { cliName, runCommand } from "./commands.js";

async function main(): Promise<void> {
  const [, , name, ...rest] = process.argv;
  if (!name) {
    console.log((await runCommand("help", [])).message);
    return;
  }
  const result = await runCommand(name, rest);
  if (result.message) console.log(result.message);
  process.exit(result.code);
}

main().catch((error: unknown) => {
  console.error(`${cliName()}: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
