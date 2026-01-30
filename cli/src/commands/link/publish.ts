import type { GlobalOptions } from "../../types";
import { ApiClient } from "../../lib/api";
import { loadConfig } from "../../lib/config";

function showPublishHelp(): void {
  console.log(`ec link publish - Publish a link

Usage: ec link publish <slug> [options]

Arguments:
  slug              The link slug to publish

Options:
  --json            Output as JSON
  --help, -h        Show this help message

Examples:
  ec link publish my-link
`);
}

export async function publish(args: string[], globalOptions: GlobalOptions): Promise<void> {
  // Check for help flag
  if (args.includes("--help") || args.includes("-h")) {
    showPublishHelp();
    return;
  }

  // Get slug from args
  const slug = args.find((arg) => !arg.startsWith("-"));

  if (!slug) {
    console.error("❌ Missing slug argument.");
    console.error("Usage: ec link publish <slug>");
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
  const result = await client.publishPost(slug);

  if (result.error) {
    if (result.error.includes("404") || result.error.includes("not found")) {
      console.error(`❌ Link not found: ${slug}`);
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
    if (post.url) {
      console.log(`   URL: ${post.url}`);
    }
  }
}
