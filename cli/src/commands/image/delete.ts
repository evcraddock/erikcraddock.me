import * as readline from "readline";
import type { GlobalOptions } from "../../types";
import { ApiClient } from "../../lib/api";
import { loadConfig } from "../../lib/config";

export interface DeleteOptions {
  yes?: boolean;
}

export function parseDeleteArgs(args: string[]): {
  id: number | null;
  options: DeleteOptions;
  help: boolean;
} {
  let id: number | null = null;
  const options: DeleteOptions = {};
  let help = false;

  for (const arg of args) {
    if (arg === "--help" || arg === "-h") {
      help = true;
    } else if (arg === "--yes" || arg === "-y") {
      options.yes = true;
    } else if (!arg.startsWith("-") && id === null) {
      const parsed = parseInt(arg, 10);
      if (!isNaN(parsed)) {
        id = parsed;
      }
    }
  }

  return { id, options, help };
}

export function showDeleteHelp(): void {
  console.log(`ec image delete - Delete an image

Usage: ec image delete <id> [options]

Arguments:
  <id>              Image ID

Options:
  --yes, -y         Skip confirmation prompt
  --help, -h        Show this help message

Examples:
  ec image delete 42
  ec image delete 42 --yes
`);
}

async function confirm(prompt: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
    });
  });
}

export async function deleteImage(args: string[], globalOptions: GlobalOptions): Promise<void> {
  const { id, options, help } = parseDeleteArgs(args);

  if (help) {
    showDeleteHelp();
    return;
  }

  if (id === null) {
    console.error("❌ Image ID is required.");
    console.error("Usage: ec image delete <id>");
    process.exit(1);
  }

  const config = await loadConfig();
  const apiUrl = globalOptions.apiUrl || config.api_url;
  const apiKey = globalOptions.apiKey || config.api_key;

  if (!apiUrl || !apiKey) {
    console.error("❌ Not configured. Run 'ec login' first.");
    process.exit(1);
  }

  const client = new ApiClient(apiUrl, apiKey);

  // First, fetch the image to verify it exists
  const mediaResult = await client.getMedia(id);

  if (mediaResult.error) {
    console.error(`❌ Error: ${mediaResult.error}`);
    process.exit(1);
  }

  const media = mediaResult.data!;

  // Confirm deletion unless --yes is used
  if (!options.yes) {
    const confirmed = await confirm(`Delete image ${id} (${media.filename})? [y/N] `);
    if (!confirmed) {
      console.log("Cancelled.");
      return;
    }
  }

  const result = await client.deleteMedia(id);

  if (result.error) {
    console.error(`❌ Error: ${result.error}`);
    process.exit(1);
  }

  console.log(`✅ Image ${id} deleted.`);
}
