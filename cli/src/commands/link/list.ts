import type { GlobalOptions, PostListItem } from "../../types";
import { ApiClient } from "../../lib/api";
import { loadConfig } from "../../lib/config";

const ALL_LINKS_LIMIT = 2_147_483_647;

interface ListOptions {
  limit?: number;
  tag?: string;
  status?: string;
}

function parseListArgs(args: string[]): { options: ListOptions; help: boolean } {
  const options: ListOptions = {};
  let help = false;

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg === "--help" || arg === "-h") {
      help = true;
    } else if (arg === "--limit" && args[i + 1]) {
      options.limit = parseInt(args[++i], 10);
    } else if (arg.startsWith("--limit=")) {
      options.limit = parseInt(arg.split("=")[1], 10);
    } else if (arg === "--tag" && args[i + 1]) {
      options.tag = args[++i];
    } else if (arg.startsWith("--tag=")) {
      options.tag = arg.split("=")[1];
    } else if (arg === "--status" && args[i + 1]) {
      options.status = args[++i];
    } else if (arg.startsWith("--status=")) {
      options.status = arg.split("=")[1];
    }

    i++;
  }

  return { options, help };
}

function showListHelp(): void {
  console.log(`ec link list - List links

Usage: ec link list [options]

Options:
  --limit <n>       Maximum number of links (default: all)
  --tag <tag>       Filter by tag slug
  --status <status> Filter by status: draft, published, all (default: all)
  --json            Output as JSON
  --help, -h        Show this help message

Examples:
  ec link list
  ec link list --limit 10
  ec link list --status published
  ec link list --tag tech
`);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  return date.toISOString().split("T")[0];
}

function truncate(str: string | null, maxLen: number): string {
  if (!str) return "-";
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + "...";
}

function formatTable(posts: PostListItem[]): void {
  if (posts.length === 0) {
    console.log("No links found.");
    return;
  }

  // Calculate column widths
  const slugWidth = Math.max(4, ...posts.map((p) => p.slug.length));
  const titleWidth = Math.min(40, Math.max(5, ...posts.map((p) => (p.title || "-").length)));
  const statusWidth = 9; // "published" is 9 chars
  const dateWidth = 10; // YYYY-MM-DD

  // Header
  const header = [
    "SLUG".padEnd(Math.min(slugWidth, 30)),
    "TITLE".padEnd(titleWidth),
    "STATUS".padEnd(statusWidth),
    "DATE".padEnd(dateWidth),
  ].join("  ");

  console.log(header);

  // Rows
  for (const post of posts) {
    const status = post.published_at ? "published" : "draft";
    const date = formatDate(post.published_at);

    const row = [
      truncate(post.slug, 30).padEnd(Math.min(slugWidth, 30)),
      truncate(post.title, titleWidth).padEnd(titleWidth),
      status.padEnd(statusWidth),
      date.padEnd(dateWidth),
    ].join("  ");

    console.log(row);
  }

  console.log(`\nTotal: ${posts.length} links`);
}

export async function list(args: string[], globalOptions: GlobalOptions): Promise<void> {
  const { options, help } = parseListArgs(args);

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
  const result = await client.listPosts({
    limit: options.limit ?? ALL_LINKS_LIMIT,
    tag: options.tag,
    status: options.status || "all",
    type: "link",
  });

  if (result.error) {
    console.error(`❌ Error: ${result.error}`);
    process.exit(1);
  }

  const posts = result.data || [];

  if (globalOptions.json) {
    console.log(JSON.stringify(posts, null, 2));
  } else {
    formatTable(posts);
  }
}
