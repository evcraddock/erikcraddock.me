import type { GlobalOptions } from "../../types";
import { ApiClient } from "../../lib/api";
import { loadConfig } from "../../lib/config";

function showUnpublishHelp(): void {
  console.log(`ec post unpublish - Unpublish a post

Usage: ec post unpublish <slug> [options]

Arguments:
  slug                The post slug to unpublish

Options:
  --json              Output as JSON
  --help, -h          Show this help message

Unpublishing a post removes it from the public website and reverts
it to draft status.

Examples:
  ec post unpublish my-post
`);
}

export async function unpublish(args: string[], globalOptions: GlobalOptions): Promise<void> {
  // Parse args
  let slug: string | undefined;
  let help = false;

  for (const arg of args) {
    if (arg === "--help" || arg === "-h") {
      help = true;
    } else if (!arg.startsWith("-")) {
      slug = arg;
    }
  }

  if (help) {
    showUnpublishHelp();
    return;
  }

  if (!slug) {
    console.error("❌ Missing slug argument.");
    console.error("Usage: ec post unpublish <slug>");
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
  const result = await client.unpublishPost(slug);

  if (result.error) {
    if (result.error.includes("404") || result.error.includes("not found")) {
      console.error(`❌ Post not found: ${slug}`);
    } else {
      console.error(`❌ Error: ${result.error}`);
    }
    process.exit(1);
  }

  const post = result.data!;

  if (globalOptions.json) {
    console.log(JSON.stringify(post, null, 2));
  } else {
    console.log(`✅ Unpublished: ${post.slug}`);
    console.log(`   Title: ${post.title || "(no title)"}`);
    console.log(`   Status: draft`);
  }
}
