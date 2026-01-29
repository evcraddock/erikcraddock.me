import type { GlobalOptions } from "../../types";
import { ApiClient } from "../../lib/api";
import { loadConfig } from "../../lib/config";

interface EditOptions {
  title?: string;
  content?: string;
  excerpt?: string;
  tags?: string[];
}

function parseEditArgs(args: string[]): { slug?: string; options: EditOptions; help: boolean } {
  const options: EditOptions = {};
  let slug: string | undefined;
  let help = false;

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg === "--help" || arg === "-h") {
      help = true;
    } else if (arg === "--title" && args[i + 1]) {
      options.title = args[++i];
    } else if (arg.startsWith("--title=")) {
      options.title = arg.split("=").slice(1).join("=");
    } else if (arg === "--content" && args[i + 1]) {
      options.content = args[++i];
    } else if (arg.startsWith("--content=")) {
      options.content = arg.split("=").slice(1).join("=");
    } else if (arg === "--excerpt" && args[i + 1]) {
      options.excerpt = args[++i];
    } else if (arg.startsWith("--excerpt=")) {
      options.excerpt = arg.split("=").slice(1).join("=");
    } else if (arg === "--tags" && args[i + 1]) {
      options.tags = args[++i].split(",").map((t) => t.trim());
    } else if (arg.startsWith("--tags=")) {
      options.tags = arg
        .split("=")
        .slice(1)
        .join("=")
        .split(",")
        .map((t) => t.trim());
    } else if (!arg.startsWith("-") && !slug) {
      slug = arg;
    }

    i++;
  }

  return { slug, options, help };
}

function showEditHelp(): void {
  console.log(`ec post edit - Edit an existing post

Usage: ec post edit <slug> [options]

Arguments:
  slug                The post slug to edit

Options:
  --title <title>     Update title
  --content <text>    Update content
  --excerpt <text>    Update excerpt
  --tags <tags>       Replace tags (comma-separated)
  --json              Output as JSON
  --help, -h          Show this help message

Examples:
  ec post edit my-post --title "Updated Title"
  ec post edit my-post --content "New content here"
  ec post edit my-post --tags tech,go,programming
  ec post edit my-post --title "New" --excerpt "Updated summary"
`);
}

export async function edit(args: string[], globalOptions: GlobalOptions): Promise<void> {
  const { slug, options, help } = parseEditArgs(args);

  if (help) {
    showEditHelp();
    return;
  }

  if (!slug) {
    console.error("❌ Missing slug argument.");
    console.error("Usage: ec post edit <slug> [options]");
    process.exit(1);
  }

  // Check if any update options provided
  if (!options.title && !options.content && !options.excerpt && !options.tags) {
    console.error("❌ No update options provided.");
    console.error("Use --title, --content, --excerpt, or --tags to specify what to update.");
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
  const result = await client.updatePost(slug, options);

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
    console.log(`✅ Post updated: ${post.slug}`);
    if (options.title) console.log(`   Title: ${post.title}`);
    if (options.content) console.log(`   Content updated`);
    if (options.excerpt) console.log(`   Excerpt: ${post.excerpt}`);
    if (options.tags) console.log(`   Tags: ${post.tags.join(", ") || "(none)"}`);
  }
}
