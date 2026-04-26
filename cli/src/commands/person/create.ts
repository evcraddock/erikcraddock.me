import type { GlobalOptions } from "../../types";
import { ApiClient } from "../../lib/api";
import { loadConfig } from "../../lib/config";

interface CreateOptions {
  name?: string;
  url?: string | null;
}

function parseCreateArgs(args: string[]): { options: CreateOptions; help: boolean } {
  const options: CreateOptions = {};
  let help = false;

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg === "--help" || arg === "-h") {
      help = true;
    } else if (arg === "--name" && args[i + 1]) {
      options.name = args[++i];
    } else if (arg.startsWith("--name=")) {
      options.name = arg.split("=").slice(1).join("=");
    } else if (arg === "--url" && args[i + 1]) {
      options.url = args[++i];
    } else if (arg.startsWith("--url=")) {
      options.url = arg.split("=").slice(1).join("=");
    }

    i++;
  }

  return { options, help };
}

function showCreateHelp(): void {
  console.log(`ec person create - Create a new person

Usage: ec person create --name <name> [options]

Required:
  --name <name>       Person name

Options:
  --url <url>         Person URL (optional)
  --json              Output as JSON
  --help, -h          Show this help message

Examples:
  ec person create --name "Ethan Mollick"
  ec person create --name "Simon Willison" --url "https://simonwillison.net/"
`);
}

export async function create(args: string[], globalOptions: GlobalOptions): Promise<void> {
  const { options, help } = parseCreateArgs(args);

  if (help) {
    showCreateHelp();
    return;
  }

  if (!options.name || options.name.trim().length === 0) {
    console.error("❌ --name is required.");
    console.error("Usage: ec person create --name <name>");
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
  const result = await client.createPerson({
    name: options.name.trim(),
    url: options.url?.trim() || null,
  });

  if (result.error) {
    console.error(`❌ Error: ${result.error}`);
    process.exit(1);
  }

  const person = result.data!;

  if (globalOptions.json) {
    console.log(JSON.stringify(person, null, 2));
  } else {
    console.log(`✅ Person created with ID: ${person.id}`);
  }
}
