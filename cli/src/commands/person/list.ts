import type { GlobalOptions, Person } from "../../types";
import { ApiClient } from "../../lib/api";
import { loadConfig } from "../../lib/config";

function parseListArgs(args: string[]): { help: boolean } {
  return { help: args.some((arg) => arg === "--help" || arg === "-h") };
}

function showListHelp(): void {
  console.log(`ec person list - List all people

Usage: ec person list [options]

Options:
  --json            Output as JSON
  --help, -h        Show this help message

Examples:
  ec person list
  ec person list --json
`);
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + "...";
}

function formatTable(people: Person[]): void {
  if (people.length === 0) {
    console.log("No people found.");
    return;
  }

  const idWidth = Math.max(2, ...people.map((person) => String(person.id).length));
  const nameWidth = Math.min(30, Math.max(4, ...people.map((person) => person.name.length)));
  const urlWidth = Math.min(50, Math.max(3, ...people.map((person) => person.url?.length ?? 1)));

  console.log(["ID".padEnd(idWidth), "NAME".padEnd(nameWidth), "URL".padEnd(urlWidth)].join("  "));

  for (const person of people) {
    console.log(
      [
        String(person.id).padEnd(idWidth),
        truncate(person.name, nameWidth).padEnd(nameWidth),
        truncate(person.url ?? "-", urlWidth).padEnd(urlWidth),
      ].join("  ")
    );
  }

  console.log(`\nTotal: ${people.length} people`);
}

export async function list(args: string[], globalOptions: GlobalOptions): Promise<void> {
  const { help } = parseListArgs(args);

  if (help) {
    showListHelp();
    return;
  }

  const config = await loadConfig(globalOptions.configPath);
  const apiUrl = globalOptions.apiUrl || config.api_url;
  const apiKey = globalOptions.apiKey || config.api_key;

  if (!apiUrl || !apiKey) {
    console.error("❌ Not configured. Run 'ec login' first.");
    process.exit(1);
  }

  const client = new ApiClient(apiUrl, apiKey);
  const result = await client.listPeople();

  if (result.error) {
    console.error(`❌ Error: ${result.error}`);
    process.exit(1);
  }

  const people = result.data || [];

  if (globalOptions.json) {
    console.log(JSON.stringify(people, null, 2));
  } else {
    formatTable(people);
  }
}
