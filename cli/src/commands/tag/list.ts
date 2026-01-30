import type { GlobalOptions, TagWithCount } from "../../types";
import { ApiClient } from "../../lib/api";
import { loadConfig } from "../../lib/config";

function parseListArgs(args: string[]): { help: boolean } {
  let help = false;

  for (const arg of args) {
    if (arg === "--help" || arg === "-h") {
      help = true;
    }
  }

  return { help };
}

function showListHelp(): void {
  console.log(`ec tag list - List all tags with post counts

Usage: ec tag list [options]

Options:
  --json            Output as JSON
  --help, -h        Show this help message

Examples:
  ec tag list
  ec tag list --json
`);
}

function formatTable(tags: TagWithCount[]): void {
  if (tags.length === 0) {
    console.log("No tags found.");
    return;
  }

  // Calculate column widths
  const tagWidth = Math.min(30, Math.max(3, ...tags.map((t) => t.slug.length)));
  const countWidth = Math.max(5, ...tags.map((t) => String(t.count).length));

  // Header
  const header = ["TAG".padEnd(tagWidth), "COUNT".padStart(countWidth)].join("  ");

  console.log(header);

  // Rows
  for (const tag of tags) {
    const row = [
      truncate(tag.slug, tagWidth).padEnd(tagWidth),
      String(tag.count).padStart(countWidth),
    ].join("  ");

    console.log(row);
  }

  console.log(`\nTotal: ${tags.length} tags`);
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + "...";
}

export async function list(args: string[], globalOptions: GlobalOptions): Promise<void> {
  const { help } = parseListArgs(args);

  if (help) {
    showListHelp();
    return;
  }

  const config = await loadConfig();
  const apiUrl = globalOptions.apiUrl || config.api_url;
  const apiKey = globalOptions.apiKey || config.api_key;

  if (!apiUrl || !apiKey) {
    console.error("❌ Not configured. Run 'ec login' first.");
    process.exit(1);
  }

  const client = new ApiClient(apiUrl, apiKey);
  const result = await client.listTags();

  if (result.error) {
    console.error(`❌ Error: ${result.error}`);
    process.exit(1);
  }

  const tags = result.data || [];

  if (globalOptions.json) {
    console.log(JSON.stringify(tags, null, 2));
  } else {
    formatTable(tags);
  }
}
