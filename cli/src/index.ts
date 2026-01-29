#!/usr/bin/env bun
import { version } from "./commands/version";
import { configShow } from "./commands/config";
import { login } from "./commands/login";
import type { GlobalOptions } from "./types";

function parseArgs(args: string[]): {
  command: string[];
  options: GlobalOptions;
} {
  const options: GlobalOptions = {};
  const command: string[] = [];

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg === "--verbose" || arg === "-v") {
      options.verbose = true;
    } else if (arg === "--json") {
      options.json = true;
    } else if (arg === "--api-url" && args[i + 1]) {
      options.apiUrl = args[++i];
    } else if (arg === "--api-key" && args[i + 1]) {
      options.apiKey = args[++i];
    } else if (arg.startsWith("--api-url=")) {
      options.apiUrl = arg.split("=")[1];
    } else if (arg.startsWith("--api-key=")) {
      options.apiKey = arg.split("=")[1];
    } else if (!arg.startsWith("-")) {
      command.push(arg);
    } else if (arg === "--help" || arg === "-h") {
      command.push("help");
    } else {
      // Unknown flag, add to command for subcommand to handle
      command.push(arg);
    }

    i++;
  }

  return { command, options };
}

function showHelp(): void {
  console.log(`ec - CLI for erikcraddock.me

Usage: ec <command> [options]

Commands:
  login           Authenticate and store API key
  config show     Show current configuration
  version         Show CLI version
  help            Show this help message

Global Options:
  --verbose, -v   Enable verbose output
  --json          Output as JSON (where applicable)
  --api-url URL   Override API URL
  --api-key KEY   Override API key

Examples:
  ec login
  ec config show
  ec version
`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const { command, options } = parseArgs(args);

  if (command.length === 0 || command[0] === "help") {
    showHelp();
    return;
  }

  const [cmd, subcmd] = command;

  switch (cmd) {
    case "version":
    case "--version":
      version();
      break;

    case "login":
      await login(options);
      break;

    case "config":
      if (subcmd === "show" || !subcmd) {
        await configShow();
      } else {
        console.error(`Unknown config command: ${subcmd}`);
        process.exit(1);
      }
      break;

    default:
      console.error(`Unknown command: ${cmd}`);
      console.error("Run 'ec help' for usage.");
      process.exit(1);
  }
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
