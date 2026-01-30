import * as readline from "readline";
import type { GlobalOptions } from "../../types";
import { ApiClient } from "../../lib/api";
import { loadConfig } from "../../lib/config";

interface DeleteOptions {
  force?: boolean;
}

function parseDeleteArgs(args: string[]): {
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
    } else if (arg === "--force" || arg === "-f") {
      options.force = true;
    } else if (!arg.startsWith("-") && id === null) {
      const parsed = parseInt(arg, 10);
      if (!isNaN(parsed)) {
        id = parsed;
      }
    }
  }

  return { id, options, help };
}

function showDeleteHelp(): void {
  console.log(`ec source delete - Delete a source

Usage: ec source delete <id> [options]

Arguments:
  <id>              Source ID

Options:
  --force, -f       Skip confirmation prompt
  --help, -h        Show this help message

Examples:
  ec source delete 1
  ec source delete 1 --force
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

export async function deleteSource(args: string[], globalOptions: GlobalOptions): Promise<void> {
  const { id, options, help } = parseDeleteArgs(args);

  if (help) {
    showDeleteHelp();
    return;
  }

  if (id === null) {
    console.error("❌ Source ID is required.");
    console.error("Usage: ec source delete <id>");
    process.exit(1);
  }

  const config = await loadConfig(globalOptions.configPath);
  const apiUrl = globalOptions.apiUrl || config.api_url;
  const apiKey = globalOptions.apiKey || config.api_key;

  if (!apiUrl || !apiKey) {
    console.error("❌ Not configured. Run 'ec login' first.");
    process.exit(1);
  }

  const client = new ApiClient(apiUrl, apiKey);

  // First, fetch the source to show its name in the confirmation
  const sourceResult = await client.getSource(id);

  if (sourceResult.error) {
    console.error(`❌ Error: ${sourceResult.error}`);
    process.exit(1);
  }

  const source = sourceResult.data!;

  // Confirm deletion unless --force is used
  if (!options.force) {
    const confirmed = await confirm(
      `Delete source '${source.name}'? This may affect linked posts. [y/N] `
    );
    if (!confirmed) {
      console.log("Cancelled.");
      return;
    }
  }

  const result = await client.deleteSource(id);

  if (result.error) {
    console.error(`❌ Error: ${result.error}`);
    process.exit(1);
  }

  console.log(`✅ Source '${source.name}' deleted.`);
}
