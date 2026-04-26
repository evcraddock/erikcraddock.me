import type { GlobalOptions } from "../../types";
import { ApiClient } from "../../lib/api";
import { loadConfig } from "../../lib/config";

interface EditOptions {
  name?: string;
  url?: string | null;
}

function parseEditArgs(args: string[]): { id: number | null; options: EditOptions; help: boolean } {
  let id: number | null = null;
  const options: EditOptions = {};
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
    } else if (arg === "--no-url") {
      options.url = null;
    } else if (!arg.startsWith("-") && id === null) {
      const parsed = parseInt(arg, 10);
      if (!isNaN(parsed)) {
        id = parsed;
      }
    }

    i++;
  }

  return { id, options, help };
}

function showEditHelp(): void {
  console.log(`ec person edit - Edit an existing person

Usage: ec person edit <id> [options]

Arguments:
  <id>                Person ID

Options:
  --name <name>       Update person name
  --url <url>         Update person URL
  --no-url            Clear person URL
  --json              Output as JSON
  --help, -h          Show this help message

Examples:
  ec person edit 1 --name "Ethan Mollick"
  ec person edit 1 --url "https://example.com"
  ec person edit 1 --no-url
`);
}

export async function edit(args: string[], globalOptions: GlobalOptions): Promise<void> {
  const { id, options, help } = parseEditArgs(args);

  if (help) {
    showEditHelp();
    return;
  }

  if (id === null) {
    console.error("❌ Person ID is required.");
    console.error("Usage: ec person edit <id> [options]");
    process.exit(1);
  }

  const hasUpdates = options.name !== undefined || options.url !== undefined;
  if (!hasUpdates) {
    console.error("❌ No update options provided.");
    console.error("Specify at least one of: --name, --url, --no-url");
    process.exit(1);
  }

  if (options.name !== undefined && options.name.trim().length === 0) {
    console.error("❌ --name cannot be empty.");
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
  const result = await client.updatePerson(id, {
    name: options.name?.trim(),
    url: options.url === undefined ? undefined : options.url?.trim() || null,
  });

  if (result.error) {
    console.error(`❌ Error: ${result.error}`);
    process.exit(1);
  }

  const person = result.data!;

  if (globalOptions.json) {
    console.log(JSON.stringify(person, null, 2));
  } else {
    console.log(`✅ Person ${person.id} updated.`);
  }
}
