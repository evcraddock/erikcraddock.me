import type { GlobalOptions } from "../../types";
import { deleteFederated } from "./delete";

export function showFederationHelp(): void {
  console.log(`ec federation - Manage ActivityPub federation

Usage: ec federation <command> [options]

Commands:
  delete <uri>      Send Delete activity for a URI

Options:
  --help, -h        Show help for a command

Examples:
  ec federation delete https://erikcraddock.me/posts/4
  ec federation delete https://erikcraddock.me/posts/old-slug
`);
}

export async function federationCommand(args: string[], options: GlobalOptions): Promise<void> {
  if (args.length === 0) {
    showFederationHelp();
    return;
  }

  const [subcmd, ...rest] = args;

  if (options.help) {
    rest.push("--help");
  }

  switch (subcmd) {
    case "delete":
      await deleteFederated(rest, options);
      break;

    default:
      console.error(`Unknown federation command: ${subcmd}`);
      console.error("Run 'ec federation --help' for usage.");
      process.exit(1);
  }
}
