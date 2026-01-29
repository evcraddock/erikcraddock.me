import * as fs from "fs";
import * as path from "path";
import type { GlobalOptions } from "../../types";
import { ApiClient } from "../../lib/api";
import { loadConfig } from "../../lib/config";
import { parseMarkdown } from "../../lib/markdown";
import { detectImages, processImages, rewriteContent } from "../../lib/images";

interface EditOptions {
  file?: string;
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
    } else if (arg === "--file" && args[i + 1]) {
      options.file = args[++i];
    } else if (arg.startsWith("--file=")) {
      options.file = arg.split("=").slice(1).join("=");
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
       ec post edit <slug> --file <path>

Arguments:
  slug                The post slug to edit

Options:
  --file <path>       Update from markdown file with frontmatter
  --title <title>     Update title
  --content <text>    Update content
  --excerpt <text>    Update excerpt
  --tags <tags>       Replace tags (comma-separated)
  --json              Output as JSON
  --help, -h          Show this help message

File-based editing:
  When using --file, content and frontmatter fields are extracted from the
  markdown file. The slug in the file is ignored (uses command argument).
  Local images are uploaded and URLs rewritten.

Examples:
  ec post edit my-post --title "Updated Title"
  ec post edit my-post --file updated.md
  ec post edit my-post --tags tech,go,programming
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

  const config = await loadConfig();
  const apiUrl = globalOptions.apiUrl || config.api_url;
  const apiKey = globalOptions.apiKey || config.api_key;

  if (!apiUrl || !apiKey) {
    console.error("❌ Not configured. Run 'ec login' first.");
    process.exit(1);
  }

  const client = new ApiClient(apiUrl, apiKey);

  // Build update payload
  let title = options.title;
  let content = options.content;
  let excerpt = options.excerpt;
  let tags = options.tags;

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
    title = options.title ?? frontmatter.title;
    excerpt = options.excerpt ?? frontmatter.excerpt;
    tags = options.tags ?? frontmatter.tags;

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
  if (!title && !content && !excerpt && !tags) {
    console.error("❌ No update options provided.");
    console.error("Use --file, --title, --content, --excerpt, or --tags.");
    process.exit(1);
  }

  const updateData: {
    title?: string;
    content?: string;
    excerpt?: string;
    tags?: string[];
  } = {};

  if (title !== undefined) updateData.title = title;
  if (content !== undefined) updateData.content = content;
  if (excerpt !== undefined) updateData.excerpt = excerpt;
  if (tags !== undefined) updateData.tags = tags;

  const result = await client.updatePost(slug, updateData);

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
    if (title) console.log(`   Title: ${post.title}`);
    if (content) console.log(`   Content updated`);
    if (excerpt) console.log(`   Excerpt: ${post.excerpt}`);
    if (tags) console.log(`   Tags: ${post.tags.join(", ") || "(none)"}`);
    if (options.file) console.log(`   Source: ${options.file}`);
  }
}
