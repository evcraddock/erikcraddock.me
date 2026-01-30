import type { GlobalOptions } from "../../types";
import { ApiClient } from "../../lib/api";
import { loadConfig } from "../../lib/config";

function showDeleteHelp(): void {
  console.log(`ec post delete - Delete a post

Usage: ec post delete <slug> [options]

Arguments:
  slug                The post slug to delete

Options:
  --force, -f         Skip confirmation prompt
  --json              Output as JSON
  --help, -h          Show this help message

Examples:
  ec post delete my-post
  ec post delete my-post --force
`);
}

async function confirm(message: string): Promise<boolean> {
  process.stdout.write(`${message} [y/N] `);

  // Read from stdin
  const stdin = process.stdin;
  stdin.setRawMode?.(false);

  return new Promise((resolve) => {
    const reader = Bun.stdin.stream().getReader();

    reader.read().then(({ value }) => {
      const input = value ? new TextDecoder().decode(value).trim().toLowerCase() : "";
      reader.releaseLock();
      resolve(input === "y" || input === "yes");
    });
  });
}

export async function deletePost(args: string[], globalOptions: GlobalOptions): Promise<void> {
  // Parse args
  let slug: string | undefined;
  let force = false;
  let help = false;

  for (const arg of args) {
    if (arg === "--help" || arg === "-h") {
      help = true;
    } else if (arg === "--force" || arg === "-f") {
      force = true;
    } else if (!arg.startsWith("-")) {
      slug = arg;
    }
  }

  if (help) {
    showDeleteHelp();
    return;
  }

  if (!slug) {
    console.error("❌ Missing slug argument.");
    console.error("Usage: ec post delete <slug>");
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

  // First, get the post to show what we're deleting
  const getResult = await client.getPost(slug);

  if (getResult.error) {
    if (getResult.error.includes("404") || getResult.error.includes("not found")) {
      console.error(`❌ Post not found: ${slug}`);
    } else {
      console.error(`❌ Error: ${getResult.error}`);
    }
    process.exit(1);
  }

  const post = getResult.data!;

  // Confirm deletion unless --force
  if (!force) {
    const title = post.title || "(no title)";
    const confirmed = await confirm(`Delete '${title}' (${slug})?`);

    if (!confirmed) {
      console.log("Cancelled.");
      return;
    }
  }

  // Delete the post
  const result = await client.deletePost(slug);

  if (result.error) {
    console.error(`❌ Error: ${result.error}`);
    process.exit(1);
  }

  if (globalOptions.json) {
    console.log(JSON.stringify({ deleted: slug }, null, 2));
  } else {
    console.log(`✅ Deleted: ${slug}`);
  }
}
