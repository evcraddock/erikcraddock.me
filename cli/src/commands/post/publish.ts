import type { GlobalOptions } from "../../types";
import { ApiClient } from "../../lib/api";
import { loadConfig } from "../../lib/config";

function showPublishHelp(): void {
  console.log(`ec post publish - Publish a post

Usage: ec post publish <slug> [options]

Arguments:
  slug                The post slug to publish

Options:
  --json              Output as JSON
  --help, -h          Show this help message

Publishing a post makes it visible on the website and federates it
to ActivityPub followers.

Examples:
  ec post publish my-post
`);
}

export async function publish(args: string[], globalOptions: GlobalOptions): Promise<void> {
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
    showPublishHelp();
    return;
  }

  if (!slug) {
    console.error("❌ Missing slug argument.");
    console.error("Usage: ec post publish <slug>");
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
  const result = await client.publishPost(slug);

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
    console.log(`✅ Published: ${post.slug}`);
    console.log(`   Title: ${post.title || "(no title)"}`);
  }
}
