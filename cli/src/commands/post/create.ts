import type { GlobalOptions } from "../../types";
import { ApiClient } from "../../lib/api";
import { loadConfig } from "../../lib/config";

interface CreateOptions {
  title?: string;
  slug?: string;
  content?: string;
  excerpt?: string;
  tags?: string[];
  type?: string;
}

function parseCreateArgs(args: string[]): { options: CreateOptions; help: boolean } {
  const options: CreateOptions = {};
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
    } else if (arg === "--slug" && args[i + 1]) {
      options.slug = args[++i];
    } else if (arg.startsWith("--slug=")) {
      options.slug = arg.split("=").slice(1).join("=");
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
    } else if (arg === "--type" && args[i + 1]) {
      options.type = args[++i];
    } else if (arg.startsWith("--type=")) {
      options.type = arg.split("=").slice(1).join("=");
    }

    i++;
  }

  return { options, help };
}

function showCreateHelp(): void {
  console.log(`ec post create - Create a new post

Usage: ec post create [options]

Options:
  --title <title>     Post title (required for articles)
  --slug <slug>       URL slug (required, lowercase letters, numbers, hyphens)
  --content <text>    Post content in markdown (required)
  --excerpt <text>    Short excerpt/summary
  --tags <tags>       Comma-separated list of tags
  --type <type>       Post type: article, link, note (default: article)
  --json              Output as JSON
  --help, -h          Show this help message

Examples:
  ec post create --title "My Post" --slug my-post --content "# Hello\\n\\nWorld"
  ec post create --title "Tech Post" --slug tech-post --content "Content" --tags tech,rust
  ec post create --type note --slug quick-note --content "A quick thought"
`);
}

export async function create(args: string[], globalOptions: GlobalOptions): Promise<void> {
  const { options, help } = parseCreateArgs(args);

  if (help) {
    showCreateHelp();
    return;
  }

  // Validate required fields
  if (!options.slug) {
    console.error("❌ Missing required option: --slug");
    console.error("Run 'ec post create --help' for usage.");
    process.exit(1);
  }

  if (!options.content) {
    console.error("❌ Missing required option: --content");
    console.error("Run 'ec post create --help' for usage.");
    process.exit(1);
  }

  const type = options.type || "article";

  if (!["article", "link", "note"].includes(type)) {
    console.error("❌ Invalid type. Must be: article, link, or note");
    process.exit(1);
  }

  if (type === "article" && !options.title) {
    console.error("❌ Articles require a title. Use --title option.");
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
  const result = await client.createPost({
    type,
    slug: options.slug,
    title: options.title,
    content: options.content,
    excerpt: options.excerpt,
    tags: options.tags,
  });

  if (result.error) {
    console.error(`❌ Error: ${result.error}`);
    process.exit(1);
  }

  const post = result.data!;

  if (globalOptions.json) {
    console.log(JSON.stringify(post, null, 2));
  } else {
    console.log(`✅ Post created: ${post.slug}`);
    console.log(`   Title: ${post.title || "(no title)"}`);
    console.log(`   Type: ${post.type}`);
    console.log(`   Status: draft`);
    if (post.tags.length > 0) {
      console.log(`   Tags: ${post.tags.join(", ")}`);
    }
  }
}
