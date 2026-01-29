import type { GlobalOptions } from "../../types";
import { list } from "./list";
import { show } from "./show";
import { create } from "./create";
import { edit } from "./edit";
import { deletePost } from "./delete";
import { publish } from "./publish";
import { unpublish } from "./unpublish";
import { pull } from "./pull";

export function showPostHelp(): void {
  console.log(`ec post - Manage posts

Usage: ec post <command> [options]

Commands:
  list              List posts
  show <slug>       Show post details
  create            Create a new post
  edit <slug>       Edit an existing post
  delete <slug>     Delete a post
  publish <slug>    Publish a post
  unpublish <slug>  Unpublish a post
  pull <slug>       Download post as markdown file

Options:
  --help, -h        Show help for a command

Examples:
  ec post list
  ec post list --status draft
  ec post show my-post
  ec post create --title "My Post" --slug my-post --content "Hello world"
  ec post create --file draft.md
  ec post edit my-post --title "Updated Title"
  ec post edit my-post --file updated.md
  ec post pull my-post
  ec post delete my-post
  ec post publish my-post
`);
}

export async function postCommand(args: string[], options: GlobalOptions): Promise<void> {
  // Only show post help if no subcommand is given
  if (args.length === 0) {
    showPostHelp();
    return;
  }

  const [subcmd, ...rest] = args;

  // If help flag is set, pass it through to subcommand
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
      await deletePost(rest, options);
      break;

    case "publish":
      await publish(rest, options);
      break;

    case "unpublish":
      await unpublish(rest, options);
      break;

    case "pull":
      await pull(rest, options);
      break;

    default:
      console.error(`Unknown post command: ${subcmd}`);
      console.error("Run 'ec post --help' for usage.");
      process.exit(1);
  }
}
