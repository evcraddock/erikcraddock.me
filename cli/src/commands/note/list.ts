import type { GlobalOptions, PostListItem } from "../../types";
import { ApiClient } from "../../lib/api";
import { loadConfig } from "../../lib/config";

interface ListOptions {
  limit?: number;
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
  console.log(`ec note list - List notes

Usage: ec note list [options]

Options:
  --limit <n>       Maximum number of notes (default: 50, max: 100)
  --status <status> Filter by status: draft, published, all (default: all)
  --json            Output as JSON
  --help, -h        Show this help message

Examples:
  ec note list
  ec note list --limit 10
  ec note list --status published
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
    console.log("No notes found.");
    return;
  }

  // Calculate column widths
  const slugWidth = Math.max(4, ...posts.map((p) => p.slug.length));
  const excerptWidth = 40;
  const statusWidth = 9;
  const dateWidth = 10;

  // Header
  const header = [
    "SLUG".padEnd(Math.min(slugWidth, 30)),
    "EXCERPT".padEnd(excerptWidth),
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
      truncate(post.excerpt, excerptWidth).padEnd(excerptWidth),
      status.padEnd(statusWidth),
      date.padEnd(dateWidth),
    ].join("  ");

    console.log(row);
  }

  console.log(`\nTotal: ${posts.length} notes`);
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
    limit: options.limit,
    status: options.status || "all",
    type: "note",
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
