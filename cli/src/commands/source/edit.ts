import type { GlobalOptions } from "../../types";
import { ApiClient } from "../../lib/api";
import { loadConfig } from "../../lib/config";

interface EditOptions {
  name?: string;
  url?: string;
  feedUrl?: string | null;
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
    } else if (arg === "--feed-url" && args[i + 1]) {
      options.feedUrl = args[++i];
    } else if (arg.startsWith("--feed-url=")) {
      options.feedUrl = arg.split("=").slice(1).join("=");
    } else if (arg === "--no-feed-url") {
      options.feedUrl = null;
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
  console.log(`ec source edit - Edit an existing source

Usage: ec source edit <id> [options]

Arguments:
  <id>                Source ID

Options:
  --name <name>       Update source name
  --url <url>         Update source URL
  --feed-url <url>    Update RSS/Atom feed URL
  --no-feed-url       Remove feed URL
  --json              Output as JSON
  --help, -h          Show this help message

Examples:
  ec source edit 1 --name "HN"
  ec source edit 1 --url "https://hn.algolia.com"
  ec source edit 1 --feed-url "https://hnrss.org/frontpage"
  ec source edit 1 --no-feed-url
`);
}

export async function edit(args: string[], globalOptions: GlobalOptions): Promise<void> {
  const { id, options, help } = parseEditArgs(args);

  if (help) {
    showEditHelp();
    return;
  }

  if (id === null) {
    console.error("❌ Source ID is required.");
    console.error("Usage: ec source edit <id> [options]");
    process.exit(1);
  }

  // Check if any update options were provided
  const hasUpdates =
    options.name !== undefined || options.url !== undefined || options.feedUrl !== undefined;

  if (!hasUpdates) {
    console.error("❌ No update options provided.");
    console.error("Specify at least one of: --name, --url, --feed-url, --no-feed-url");
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
  const result = await client.updateSource(id, {
    name: options.name,
    url: options.url,
    feed_url: options.feedUrl,
  });

  if (result.error) {
    console.error(`❌ Error: ${result.error}`);
    process.exit(1);
  }

  const source = result.data!;

  if (globalOptions.json) {
    console.log(JSON.stringify(source, null, 2));
  } else {
    console.log(`✅ Source ${source.id} updated.`);
  }
}
