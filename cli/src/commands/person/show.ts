import type { GlobalOptions, Person } from "../../types";
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
  console.log(`ec person show - Show person details

Usage: ec person show <id> [options]

Arguments:
  <id>              Person ID

Options:
  --json            Output as JSON
  --help, -h        Show this help message

Examples:
  ec person show 1
  ec person show 1 --json
`);
}

function formatPerson(person: Person): void {
  console.log(`ID:   ${person.id}`);
  console.log(`Name: ${person.name}`);
  console.log(`URL:  ${person.url || "-"}`);

  if (person.social_accounts.length > 0) {
    console.log("Social accounts:");
    for (const account of person.social_accounts) {
      const activityPub = account.is_activitypub ? " (ActivityPub)" : "";
      console.log(`  - ${account.label}: ${account.url}${activityPub}`);
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
    console.error("❌ Person ID is required.");
    console.error("Usage: ec person show <id>");
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
  const result = await client.getPerson(id);

  if (result.error) {
    console.error(`❌ Error: ${result.error}`);
    process.exit(1);
  }

  const person = result.data!;

  if (globalOptions.json) {
    console.log(JSON.stringify(person, null, 2));
  } else {
    formatPerson(person);
  }
}
