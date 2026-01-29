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
  console.log(`ec note pull - Download a note as markdown

Usage: ec note pull <slug> [options]

Arguments:
  slug                The note slug to download

Options:
  --output, -o <path> Output file path (default: <slug>.md)
  --json              Output note data as JSON instead of markdown
  --help, -h          Show this help message

Examples:
  ec note pull my-note
  ec note pull my-note --output ./notes/thought.md
  ec note pull my-note -o note.md
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
    console.error("Usage: ec note pull <slug>");
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
    return;
  }

  // Generate frontmatter (minimal for notes)
  const frontmatter: PostFrontmatter = {
    slug: post.slug,
    type: post.type,
    status: post.published_at ? "published" : "draft",
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
  console.log(`   Status: ${post.published_at ? "published" : "draft"}`);
}
