import * as fs from "fs";
import * as path from "path";
import type { GlobalOptions } from "../../types";
import { ApiClient } from "../../lib/api";
import { loadConfig } from "../../lib/config";
import { generateMarkdown, type PostFrontmatter } from "../../lib/markdown";

interface PullOptions {
  output?: string;
}

function parsePullArgs(args: string[]): { slug?: string; options: PullOptions; help: boolean } {
  const options: PullOptions = {};
  let slug: string | undefined;
  let help = false;

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg === "--help" || arg === "-h") {
      help = true;
    } else if (arg === "--output" && args[i + 1]) {
      options.output = args[++i];
    } else if (arg.startsWith("--output=")) {
      options.output = arg.split("=").slice(1).join("=");
    } else if (arg === "-o" && args[i + 1]) {
      options.output = args[++i];
    } else if (!arg.startsWith("-") && !slug) {
      slug = arg;
    }

    i++;
  }

  return { slug, options, help };
}

function showPullHelp(): void {
  console.log(`ec link pull - Download a link as markdown

Usage: ec link pull <slug> [options]

Arguments:
  slug                The link slug to download

Options:
  --output, -o <path> Output file path (default: <slug>.md)
  --json              Output link data as JSON instead of markdown
  --help, -h          Show this help message

Examples:
  ec link pull my-link
  ec link pull my-link --output ./links/article.md
  ec link pull my-link -o link.md
`);
}

export async function pull(args: string[], globalOptions: GlobalOptions): Promise<void> {
  const { slug, options, help } = parsePullArgs(args);

  if (help) {
    showPullHelp();
    return;
  }

  if (!slug) {
    console.error("❌ Missing slug argument.");
    console.error("Usage: ec link pull <slug>");
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
  const result = await client.getPost(slug);

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
    return;
  }

  // Generate frontmatter with link-specific fields
  const frontmatter: PostFrontmatter = {
    slug: post.slug,
    type: post.type,
    url: post.url || undefined,
    title: post.title || undefined,
    source: post.source_id ? String(post.source_id) : undefined,
    status: post.published_at ? "published" : "draft",
    tags: post.tags.length > 0 ? post.tags : undefined,
    excerpt: post.excerpt || undefined,
    created: post.created_at.split("T")[0],
  };

  const markdown = generateMarkdown(frontmatter, post.content);

  // Determine output path
  const outputPath = options.output || `${slug}.md`;
  const resolvedPath = path.resolve(outputPath);

  // Ensure directory exists
  const dir = path.dirname(resolvedPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Write file
  fs.writeFileSync(resolvedPath, markdown, "utf-8");

  console.log(`✅ Downloaded: ${outputPath}`);
  if (post.url) {
    console.log(`   URL: ${post.url}`);
  }
  if (post.title) {
    console.log(`   Title: ${post.title}`);
  }
  console.log(`   Status: ${post.published_at ? "published" : "draft"}`);
}
