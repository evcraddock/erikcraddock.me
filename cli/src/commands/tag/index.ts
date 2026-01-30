import type { GlobalOptions } from "../../types";
import { list } from "./list";

export function showTagHelp(): void {
  console.log(`ec tag - Manage tags

Usage: ec tag <command> [options]

Commands:
  list              List all tags with post counts

Options:
  --help, -h        Show help for a command

Examples:
  ec tag list
  ec tag list --json
`);
}

export async function tagCommand(args: string[], options: GlobalOptions): Promise<void> {
  if (args.length === 0) {
    showTagHelp();
    return;
  }

  const [subcmd, ...rest] = args;

  if (options.help) {
    rest.push("--help");
  }

  switch (subcmd) {
    case "list":
      await list(rest, options);
      break;

    default:
      console.error(`Unknown tag command: ${subcmd}`);
      console.error("Run 'ec tag --help' for usage.");
      process.exit(1);
  }
}
