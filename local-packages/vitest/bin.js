#!/usr/bin/env node
import { spawnSync } from "node:child_process";
const args = process.argv.slice(2);
const normalizedArgs = args[0] === "run" ? args.slice(1) : args;
const result = spawnSync("bun", ["test", ...normalizedArgs], { stdio: "inherit" });
process.exit(result.status ?? 0);
