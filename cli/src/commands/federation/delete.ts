import type { GlobalOptions } from "../../types";
import { ApiClient } from "../../lib/api";
import { loadConfig } from "../../lib/config";

function showDeleteHelp(): void {
  console.log(`ec federation delete - Send Delete activity for a URI

Usage: ec federation delete <uri> [options]

Arguments:
  uri                 The full URI to delete (e.g., https://erikcraddock.me/posts/4)

Options:
  --json              Output as JSON
  --help, -h          Show this help message

Use this to:
- Delete posts that were federated with old URIs
- Clean up posts during development
- Remove posts from remote servers after local deletion

Examples:
  ec federation delete https://erikcraddock.me/posts/4
  ec federation delete https://erikcraddock.me/posts/old-slug
`);
}

export async function deleteFederated(args: string[], globalOptions: GlobalOptions): Promise<void> {
  let uri: string | undefined;
  let help = false;

  for (const arg of args) {
    if (arg === "--help" || arg === "-h") {
      help = true;
    } else if (!arg.startsWith("-")) {
      uri = arg;
    }
  }

  if (help) {
    showDeleteHelp();
    return;
  }

  if (!uri) {
    console.error("❌ Missing uri argument.");
    console.error("Usage: ec federation delete <uri>");
    process.exit(1);
  }

  // Validate URI format
  try {
    new URL(uri);
  } catch {
    console.error(`❌ Invalid URI: ${uri}`);
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

  const result = await client.federationDelete(uri);

  if (result.error) {
    console.error(`❌ Error: ${result.error}`);
    process.exit(1);
  }

  if (globalOptions.json) {
    console.log(JSON.stringify(result.data, null, 2));
  } else {
    console.log(`✅ Delete activity sent for: ${uri}`);
  }
}
