import type { GlobalOptions } from "../../types";
import { list } from "./list";
import { show } from "./show";
import { create } from "./create";
import { edit } from "./edit";

export function showPersonHelp(): void {
  console.log(`ec person - Manage reusable attribution people

Usage: ec person <command> [options]

Commands:
  list              List all people
  show <id>         Show person details
  create            Create a new person
  edit <id>         Edit an existing person

Options:
  --help, -h        Show help for a command

Examples:
  ec person list
  ec person show 1
  ec person create --name "Ethan Mollick"
  ec person edit 1 --url "https://example.com"
  ec person edit 1 --no-url
`);
}

export async function personCommand(args: string[], options: GlobalOptions): Promise<void> {
  if (args.length === 0) {
    showPersonHelp();
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

    case "show":
      await show(rest, options);
      break;

    case "create":
      await create(rest, options);
      break;

    case "edit":
      await edit(rest, options);
      break;

    default:
      console.error(`Unknown person command: ${subcmd}`);
      console.error("Run 'ec person --help' for usage.");
      process.exit(1);
  }
}
