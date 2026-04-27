import type { GlobalOptions, Source } from "../../types";
import { ApiClient } from "../../lib/api";
import { loadConfig } from "../../lib/config";

function parseShowArgs(args: string[]): { id: number | null; help: boolean } {
  let id: number | null = null;
  let help = false;

  for (const arg of args) {
    if (arg === "--help" || arg === "-h") {
      help = true;
    } else if (!arg.startsWith("-") && id === null) {
      const parsed = parseInt(arg, 10);
      if (!isNaN(parsed)) {
        id = parsed;
      }
    }
  }

  return { id, help };
}

function showShowHelp(): void {
  console.log(`ec source show - Show source details

Usage: ec source show <id> [options]

Arguments:
  <id>              Source ID

Options:
  --json            Output as JSON
  --help, -h        Show this help message

Examples:
  ec source show 1
  ec source show 1 --json
`);
}

function formatAuthors(source: Source): string {
  if (source.authors.length === 0) return "-";
  return source.authors.map((author) => author.name).join(", ");
}

function formatSource(source: Source): void {
  console.log(`ID:        ${source.id}`);
  console.log(`Name:      ${source.name}`);
  console.log(`URL:       ${source.url}`);
  console.log(`Authors:   ${formatAuthors(source)}`);
  console.log(`Feed URL:  ${source.feed_url || "-"}`);

  if (source.social_accounts.length > 0) {
    console.log("Socials:");
    for (const account of source.social_accounts) {
      const flags = [
        account.is_activitypub ? "ActivityPub" : null,
        account.is_default ? "default" : null,
      ].filter(Boolean);
      console.log(
        `  - ${account.id}: ${account.label} ${account.url}${flags.length ? ` (${flags.join(", ")})` : ""}`
      );
    }
  }
}

export async function show(args: string[], globalOptions: GlobalOptions): Promise<void> {
  const { id, help } = parseShowArgs(args);

  if (help) {
    showShowHelp();
    return;
  }

  if (id === null) {
    console.error("❌ Source ID is required.");
    console.error("Usage: ec source show <id>");
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
  const result = await client.getSource(id);

  if (result.error) {
    console.error(`❌ Error: ${result.error}`);
    process.exit(1);
  }

  const source = result.data!;

  if (globalOptions.json) {
    console.log(JSON.stringify(source, null, 2));
  } else {
    formatSource(source);
  }
}
