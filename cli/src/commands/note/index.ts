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
  console.log(`ec note - Manage notes

Usage: ec note <command> [options]

Commands:
  list                List notes
  show <slug>         Show note details
  create              Create a new note
  edit <slug>         Edit an existing note
  delete <slug>       Delete a note
  publish <slug>      Publish a note
  unpublish <slug>    Unpublish a note
  pull <slug>         Download note as markdown file

Options:
  --json              Output as JSON (where applicable)
  --help, -h          Show help for a command

Examples:
  ec note list
  ec note create --slug quick-thought --content "Just a quick thought"
  ec note show quick-thought
  ec note publish quick-thought
  ec note pull quick-thought
`);
}

export async function noteCommand(args: string[], globalOptions: GlobalOptions): Promise<void> {
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
      console.error(`Unknown note command: ${subcommand}`);
      console.error("Run 'ec note --help' for usage.");
      process.exit(1);
  }
}
