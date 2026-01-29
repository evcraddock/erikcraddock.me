import type { GlobalOptions, Post } from "../../types";
import { ApiClient } from "../../lib/api";
import { loadConfig } from "../../lib/config";

function showShowHelp(): void {
  console.log(`ec note show - Show note details

Usage: ec note show <slug> [options]

Arguments:
  slug              The note slug to show

Options:
  --json            Output as JSON
  --help, -h        Show this help message

Examples:
  ec note show quick-thought
  ec note show quick-thought --json
`);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  return date.toISOString().replace("T", " ").slice(0, 19);
}

function formatNote(post: Post): void {
  const status = post.published_at ? "published" : "draft";

  console.log(`Slug:      ${post.slug}`);
  console.log(`Status:    ${status}`);
  console.log(`Created:   ${formatDate(post.created_at)}`);
  console.log(`Updated:   ${formatDate(post.updated_at)}`);
  if (post.published_at) {
    console.log(`Published: ${formatDate(post.published_at)}`);
  }
  console.log("");
  console.log("---");
  console.log(post.content);
}

export async function show(args: string[], globalOptions: GlobalOptions): Promise<void> {
  // Check for help flag
  if (args.includes("--help") || args.includes("-h")) {
    showShowHelp();
    return;
  }

  // Get slug from args (first non-flag argument)
  const slug = args.find((arg) => !arg.startsWith("-"));

  if (!slug) {
    console.error("❌ Missing slug argument.");
    console.error("Usage: ec note show <slug>");
    process.exit(1);
  }

  const config = await loadConfig();
  const apiUrl = globalOptions.apiUrl || config.api_url;
  const apiKey = globalOptions.apiKey || config.api_key;

  if (!apiUrl || !apiKey) {
    console.error("❌ Not configured. Run 'ec login' first.");
    process.exit(1);
  }

  const client = new ApiClient(apiUrl, apiKey);
  const result = await client.getPost(slug);

  if (result.error) {
    if (result.error.includes("404") || result.error.includes("not found")) {
      console.error(`❌ Note not found: ${slug}`);
    } else {
      console.error(`❌ Error: ${result.error}`);
    }
    process.exit(1);
  }

  const post = result.data!;

  if (globalOptions.json) {
    console.log(JSON.stringify(post, null, 2));
  } else {
    formatNote(post);
  }
}
