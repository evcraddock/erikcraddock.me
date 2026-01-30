import type { GlobalOptions, Source } from "../../types";
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
  console.log(`ec source list - List all sources

Usage: ec source list [options]

Options:
  --json            Output as JSON
  --help, -h        Show this help message

Examples:
  ec source list
  ec source list --json
`);
}

function formatTable(sources: Source[]): void {
  if (sources.length === 0) {
    console.log("No sources found.");
    return;
  }

  // Calculate column widths
  const idWidth = Math.max(2, ...sources.map((s) => String(s.id).length));
  const nameWidth = Math.min(30, Math.max(4, ...sources.map((s) => s.name.length)));
  const urlWidth = Math.min(50, Math.max(3, ...sources.map((s) => s.url.length)));

  // Header
  const header = ["ID".padEnd(idWidth), "NAME".padEnd(nameWidth), "URL".padEnd(urlWidth)].join(
    "  "
  );

  console.log(header);

  // Rows
  for (const source of sources) {
    const row = [
      String(source.id).padEnd(idWidth),
      truncate(source.name, nameWidth).padEnd(nameWidth),
      truncate(source.url, urlWidth).padEnd(urlWidth),
    ].join("  ");

    console.log(row);
  }

  console.log(`\nTotal: ${sources.length} sources`);
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
  const result = await client.listSources();

  if (result.error) {
    console.error(`❌ Error: ${result.error}`);
    process.exit(1);
  }

  const sources = result.data || [];

  if (globalOptions.json) {
    console.log(JSON.stringify(sources, null, 2));
  } else {
    formatTable(sources);
  }
}
