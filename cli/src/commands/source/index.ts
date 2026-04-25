import type { GlobalOptions } from "../../types";
import { list } from "./list";
import { show } from "./show";
import { create } from "./create";
import { edit } from "./edit";
import { deleteSource } from "./delete";

export function showSourceHelp(): void {
  console.log(`ec source - Manage sources

Usage: ec source <command> [options]

Commands:
  list              List all sources
  show <id>         Show source details
  create            Create a new source
  edit <id>         Edit an existing source
  delete <id>       Delete a source

Options:
  --help, -h        Show help for a command

Examples:
  ec source list
  ec source show 1
  ec source create --name "Hacker News" --url "https://news.ycombinator.com" --author "Paul Graham" --author "Jessica Livingston"
  ec source edit 1 --name "HN"
  ec source delete 1
`);
}

export async function sourceCommand(args: string[], options: GlobalOptions): Promise<void> {
  if (args.length === 0) {
    showSourceHelp();
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

    case "delete":
      await deleteSource(rest, options);
      break;

    default:
      console.error(`Unknown source command: ${subcmd}`);
      console.error("Run 'ec source --help' for usage.");
      process.exit(1);
  }
}
