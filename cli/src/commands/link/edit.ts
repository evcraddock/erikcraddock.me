import * as fs from "fs";
import * as path from "path";
import type { GlobalOptions } from "../../types";
import { ApiClient } from "../../lib/api";
import { loadConfig } from "../../lib/config";
import { parseMarkdown } from "../../lib/markdown";
import { detectImages, processImages, rewriteContent } from "../../lib/images";

interface EditOptions {
  file?: string;
  url?: string;
  title?: string;
  content?: string;
  excerpt?: string;
  tags?: string[];
  source?: string;
  author?: string | null;
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
    } else if (arg === "--file" && args[i + 1]) {
      options.file = args[++i];
    } else if (arg.startsWith("--file=")) {
      options.file = arg.split("=").slice(1).join("=");
    } else if (arg === "--url" && args[i + 1]) {
      options.url = args[++i];
    } else if (arg.startsWith("--url=")) {
      options.url = arg.split("=").slice(1).join("=");
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
    } else if (arg === "--source" && args[i + 1]) {
      options.source = args[++i];
    } else if (arg.startsWith("--source=")) {
      options.source = arg.split("=").slice(1).join("=");
    } else if (arg === "--author" && args[i + 1]) {
      options.author = args[++i];
    } else if (arg.startsWith("--author=")) {
      options.author = arg.split("=").slice(1).join("=");
    } else if (arg === "--no-author") {
      options.author = null;
    } else if (!arg.startsWith("-") && !slug) {
      slug = arg;
    }

    i++;
  }

  return { slug, options, help };
}

function showEditHelp(): void {
  console.log(`ec link edit - Edit an existing link

Usage: ec link edit <slug> [options]
       ec link edit <slug> --file <path>

Arguments:
  slug                The link slug to edit

Options:
  --file <path>       Update from markdown file with frontmatter
  --url <url>         Update external URL
  --title <title>     Update title
  --content <text>    Update commentary
  --excerpt <text>    Update excerpt
  --tags <tags>       Replace tags (comma-separated)
  --source <id>       Update source ID
  --author <id>       Update author person ID
  --no-author         Clear author
  --json              Output as JSON
  --help, -h          Show this help message

File-based editing:
  When using --file, content and frontmatter fields are extracted from the
  markdown file. The slug in the file is ignored (uses command argument).
  Local images are uploaded and URLs rewritten.

Examples:
  ec link edit my-link --url "https://new-url.com"
  ec link edit my-link --file updated.md
  ec link edit my-link --tags tech,programming
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
    console.error("Usage: ec link edit <slug> [options]");
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

  // Build update payload
  let url = options.url;
  let title = options.title;
  let content = options.content;
  let excerpt = options.excerpt;
  let tags = options.tags;
  let source = options.source;
  let author = options.author;

  if (options.file) {
    // File-based editing
    const filePath = path.resolve(options.file);

    if (!fs.existsSync(filePath)) {
      console.error(`❌ File not found: ${options.file}`);
      process.exit(1);
    }

    const fileContent = fs.readFileSync(filePath, "utf-8");
    const basePath = path.dirname(filePath);
    const { frontmatter, content: bodyContent } = parseMarkdown(fileContent);

    // Use frontmatter values (CLI overrides if provided)
    url = options.url ?? frontmatter.url;
    title = options.title ?? frontmatter.title;
    excerpt = options.excerpt ?? frontmatter.excerpt;
    tags = options.tags ?? frontmatter.tags;
    source = options.source ?? frontmatter.source;
    author = options.author ?? frontmatter.author;

    // Process images
    const banner = frontmatter.banner;
    const imageRefs = detectImages(banner, bodyContent, basePath);
    const localImages = imageRefs.filter((r) => r.type === "local" || r.type === "id");

    if (localImages.length > 0) {
      console.log(`📤 Processing ${localImages.length} image(s)...`);

      try {
        const { urlMap } = await processImages(imageRefs, slug, client);
        content = rewriteContent(bodyContent, urlMap);
      } catch (error) {
        console.error(`❌ Image processing failed: ${error}`);
        process.exit(1);
      }
    } else {
      content = bodyContent;
    }
  }

  // Check if any update options provided
  if (!url && !title && !content && !excerpt && !tags && !source && author === undefined) {
    console.error("❌ No update options provided.");
    console.error(
      "Use --file, --url, --title, --content, --excerpt, --tags, --source, --author, or --no-author."
    );
    process.exit(1);
  }

  // Parse source ID if provided
  let sourceId: number | undefined;
  if (source) {
    sourceId = parseInt(source, 10);
    if (isNaN(sourceId) || sourceId <= 0) {
      console.error("❌ Invalid source ID. Must be a positive integer.");
      process.exit(1);
    }
  }

  let authorId: number | null | undefined;
  if (author !== undefined && author !== null) {
    authorId = parseInt(author, 10);
    if (isNaN(authorId) || authorId <= 0) {
      console.error("❌ Invalid author ID. Must be a positive integer.");
      process.exit(1);
    }
  } else if (author === null) {
    authorId = null;
  }

  const updateData: {
    url?: string;
    title?: string;
    content?: string;
    excerpt?: string;
    tags?: string[];
    source_id?: number;
    author_id?: number | null;
  } = {};

  if (url !== undefined) updateData.url = url;
  if (title !== undefined) updateData.title = title;
  if (content !== undefined) updateData.content = content;
  if (excerpt !== undefined) updateData.excerpt = excerpt;
  if (tags !== undefined) updateData.tags = tags;
  if (sourceId !== undefined) updateData.source_id = sourceId;
  if (authorId !== undefined) updateData.author_id = authorId;

  const result = await client.updatePost(slug, updateData);

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
    console.log(`✅ Link updated: ${post.slug}`);
    if (url) console.log(`   URL: ${url}`);
    if (title) console.log(`   Title: ${post.title}`);
    if (content) console.log(`   Content updated`);
    if (excerpt) console.log(`   Excerpt: ${post.excerpt}`);
    if (tags) console.log(`   Tags: ${post.tags.join(", ") || "(none)"}`);
    if (options.file) console.log(`   Source: ${options.file}`);
  }
}
