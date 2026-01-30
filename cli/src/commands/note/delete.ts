import * as readline from "readline";
import type { GlobalOptions } from "../../types";
import { ApiClient } from "../../lib/api";
import { loadConfig } from "../../lib/config";

function showDeleteHelp(): void {
  console.log(`ec note delete - Delete a note

Usage: ec note delete <slug> [options]

Arguments:
  slug              The note slug to delete

Options:
  --force, -f       Skip confirmation prompt
  --json            Output as JSON
  --help, -h        Show this help message

Examples:
  ec note delete old-note
  ec note delete old-note --force
`);
}

function confirm(prompt: string): Promise<boolean> {
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

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + "...";
}

export async function del(args: string[], globalOptions: GlobalOptions): Promise<void> {
  // Check for help flag
  if (args.includes("--help") || args.includes("-h")) {
    showDeleteHelp();
    return;
  }

  // Parse args
  const force = args.includes("--force") || args.includes("-f");
  const slug = args.find((arg) => !arg.startsWith("-"));

  if (!slug) {
    console.error("❌ Missing slug argument.");
    console.error("Usage: ec note delete <slug>");
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

  // Verify note exists first
  const existing = await client.getPost(slug);
  if (existing.error) {
    if (existing.error.includes("404") || existing.error.includes("not found")) {
      console.error(`❌ Note not found: ${slug}`);
    } else {
      console.error(`❌ Error: ${existing.error}`);
    }
    process.exit(1);
  }

  // Confirm deletion
  if (!force) {
    const note = existing.data!;
    console.log(`About to delete note: ${slug}`);
    console.log(`  Content: ${truncate(note.content, 60)}`);
    console.log("");

    const confirmed = await confirm("Are you sure? (y/N): ");
    if (!confirmed) {
      console.log("Cancelled.");
      return;
    }
  }

  const result = await client.deletePost(slug);

  if (result.error) {
    console.error(`❌ Error: ${result.error}`);
    process.exit(1);
  }

  if (globalOptions.json) {
    console.log(JSON.stringify({ success: true, slug }, null, 2));
  } else {
    console.log(`✅ Deleted: ${slug}`);
  }
}
