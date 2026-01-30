import type { GlobalOptions } from "../../types";
import { ApiClient } from "../../lib/api";
import { loadConfig } from "../../lib/config";

function showUnpublishHelp(): void {
  console.log(`ec link unpublish - Unpublish a link

Usage: ec link unpublish <slug> [options]

Arguments:
  slug              The link slug to unpublish

Options:
  --json            Output as JSON
  --help, -h        Show this help message

Examples:
  ec link unpublish my-link
`);
}

export async function unpublish(args: string[], globalOptions: GlobalOptions): Promise<void> {
  // Check for help flag
  if (args.includes("--help") || args.includes("-h")) {
    showUnpublishHelp();
    return;
  }

  // Get slug from args
  const slug = args.find((arg) => !arg.startsWith("-"));

  if (!slug) {
    console.error("❌ Missing slug argument.");
    console.error("Usage: ec link unpublish <slug>");
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
  const result = await client.unpublishPost(slug);

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
    console.log(`✅ Unpublished: ${post.slug}`);
  }
}
