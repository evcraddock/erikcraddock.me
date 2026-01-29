import type { GlobalOptions } from "../../types";
import { list } from "./list";
import { show } from "./show";
import { create } from "./create";
import { edit } from "./edit";
import { del } from "./delete";
import { publish } from "./publish";
import { unpublish } from "./unpublish";
import { pull } from "./pull";

function showHelp(): void {
  console.log(`ec link - Manage links (linkblog)

Usage: ec link <command> [options]

Commands:
  list                List links
  show <slug>         Show link details
  create              Create a new link
  edit <slug>         Edit an existing link
  delete <slug>       Delete a link
  publish <slug>      Publish a link
  unpublish <slug>    Unpublish a link
  pull <slug>         Download link as markdown file

Options:
  --json              Output as JSON (where applicable)
  --help, -h          Show help for a command

Examples:
  ec link list
  ec link create --url "https://..." --slug my-link --content "Commentary"
  ec link show my-link
  ec link publish my-link
  ec link pull my-link
`);
}

export async function linkCommand(args: string[], globalOptions: GlobalOptions): Promise<void> {
  const [subcommand, ...rest] = args;

  if (!subcommand || subcommand === "--help" || subcommand === "-h") {
    showHelp();
    return;
  }

  switch (subcommand) {
    case "list":
      await list(rest, globalOptions);
      break;
    case "show":
      await show(rest, globalOptions);
      break;
    case "create":
      await create(rest, globalOptions);
      break;
    case "edit":
      await edit(rest, globalOptions);
      break;
    case "delete":
      await del(rest, globalOptions);
      break;
    case "publish":
      await publish(rest, globalOptions);
      break;
    case "unpublish":
      await unpublish(rest, globalOptions);
      break;
    case "pull":
      await pull(rest, globalOptions);
      break;
    default:
      console.error(`Unknown link command: ${subcommand}`);
      console.error("Run 'ec link --help' for usage.");
      process.exit(1);
  }
}
