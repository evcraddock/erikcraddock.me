import type { GlobalOptions } from "../../types";
import { upload } from "./upload";
import { deleteImage } from "./delete";

export function showImageHelp(): void {
  console.log(`ec image - Manage images

Usage: ec image <command> [options]

Commands:
  upload <file>     Upload an image
  delete <id>       Delete an image

Options:
  --help, -h        Show help for a command

Examples:
  ec image upload ./photo.jpg
  ec image upload ./photo.jpg --alt "A sunset"
  ec image upload ./photo.jpg --post my-post
  ec image upload ./photo.jpg --key "custom/path.jpg"
  ec image delete 42
`);
}

export async function imageCommand(args: string[], options: GlobalOptions): Promise<void> {
  if (args.length === 0) {
    showImageHelp();
    return;
  }

  const [subcmd, ...rest] = args;

  if (options.help) {
    rest.push("--help");
  }

  switch (subcmd) {
    case "upload":
      await upload(rest, options);
      break;

    case "delete":
      await deleteImage(rest, options);
      break;

    default:
      console.error(`Unknown image command: ${subcmd}`);
      console.error("Run 'ec image --help' for usage.");
      process.exit(1);
  }
}
