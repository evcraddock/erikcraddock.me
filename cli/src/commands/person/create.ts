import type { GlobalOptions } from "../../types";
import { ApiClient } from "../../lib/api";
import { loadConfig } from "../../lib/config";

interface SocialAccountOption {
  label: string;
  url: string;
  avatar_url?: string | null;
  is_activitypub?: boolean;
  is_default?: boolean;
}

interface CreateOptions {
  name?: string;
  url?: string | null;
  socialAccounts: SocialAccountOption[];
}

function parseCreateArgs(args: string[]): { options: CreateOptions; help: boolean } {
  const options: CreateOptions = { socialAccounts: [] };
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
    } else if (arg === "--social" && args[i + 1]) {
      const parsed = parseSocialAccount(args[++i]);
      if (parsed) options.socialAccounts.push(parsed);
    } else if (arg.startsWith("--social=")) {
      const parsed = parseSocialAccount(arg.split("=").slice(1).join("="));
      if (parsed) options.socialAccounts.push(parsed);
    }

    i++;
  }

  return { options, help };
}

function parseSocialAccount(input: string): SocialAccountOption | null {
  const [label, url, ...flags] = input.split("|").map((part) => part.trim());
  if (!label || !url) {
    return null;
  }

  return {
    label,
    url,
    avatar_url: flags.find((flag) => flag.startsWith("avatar="))?.slice("avatar=".length),
    is_activitypub: flags.some((flag) => ["activitypub", "ap", "true"].includes(flag)),
    is_default: flags.includes("default"),
  };
}

function showCreateHelp(): void {
  console.log(`ec person create - Create a new person

Usage: ec person create --name <name> [options]

Required:
  --name <name>       Person name

Options:
  --url <url>         Person URL (optional)
  --social <account>  Social account as "label|url|activitypub|default|avatar=URL" (can be repeated)
  --json              Output as JSON
  --help, -h          Show this help message

Examples:
  ec person create --name "Ethan Mollick"
  ec person create --name "Simon Willison" --url "https://simonwillison.net/"
  ec person create --name "Example" --social "Mastodon|https://example.social/@person|activitypub|default|avatar=https://example.social/avatar.jpg"
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
    social_accounts: options.socialAccounts,
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
