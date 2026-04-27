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
  url?: string;
  feedUrl?: string;
  authors: string[];
  socialAccounts: SocialAccountOption[];
}

function parseCreateArgs(args: string[]): { options: CreateOptions; help: boolean } {
  const options: CreateOptions = { authors: [], socialAccounts: [] };
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
    } else if (arg === "--author" && args[i + 1]) {
      options.authors.push(args[++i]);
    } else if (arg.startsWith("--author=")) {
      options.authors.push(arg.split("=").slice(1).join("="));
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
  console.log(`ec source create - Create a new source

Usage: ec source create --name <name> --url <url> [options]

Required:
  --name <name>       Source name
  --url <url>         Source URL

Options:
  --feed-url <url>    RSS/Atom feed URL (optional)
  --author <name>     Source author name (can be repeated)
  --social <account>  Social account as "label|url|activitypub|default|avatar=URL" (can be repeated)
  --json              Output as JSON
  --help, -h          Show this help message

Examples:
  ec source create --name "Hacker News" --url "https://news.ycombinator.com"
  ec source create --name "One Useful Thing" --url "https://www.oneusefulthing.org/" --author "Ethan Mollick" --feed-url "https://www.oneusefulthing.org/feed"
  ec source create --name "Team Blog" --url "https://example.com" --author "Alice" --author "Bob"
  ec source create --name "Newsletter" --url "https://example.com" --social "Email|hello@example.com"
`);
}

export async function create(args: string[], globalOptions: GlobalOptions): Promise<void> {
  const { options, help } = parseCreateArgs(args);

  if (help) {
    showCreateHelp();
    return;
  }

  if (!options.name) {
    console.error("❌ --name is required.");
    console.error("Usage: ec source create --name <name> --url <url>");
    process.exit(1);
  }

  if (!options.url) {
    console.error("❌ --url is required.");
    console.error("Usage: ec source create --name <name> --url <url>");
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
  const result = await client.createSource({
    name: options.name,
    url: options.url,
    feed_url: options.feedUrl,
    authors: options.authors.map((name) => ({ name })),
    social_accounts: options.socialAccounts,
  });

  if (result.error) {
    console.error(`❌ Error: ${result.error}`);
    process.exit(1);
  }

  const source = result.data!;

  if (globalOptions.json) {
    console.log(JSON.stringify(source, null, 2));
  } else {
    console.log(`✅ Source created with ID: ${source.id}`);
  }
}
