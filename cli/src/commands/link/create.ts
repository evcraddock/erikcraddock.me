import * as fs from "fs";
import * as path from "path";
import type { GlobalOptions } from "../../types";
import { ApiClient } from "../../lib/api";
import { loadConfig } from "../../lib/config";
import { parseMarkdown } from "../../lib/markdown";
import { detectImages, processImages, rewriteContent } from "../../lib/images";

interface CreateOptions {
  file?: string;
  url?: string;
  title?: string;
  slug?: string;
  content?: string;
  excerpt?: string;
  tags?: string[];
  source?: string;
}

function parseCreateArgs(args: string[]): { options: CreateOptions; help: boolean } {
  const options: CreateOptions = {};
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
    } else if (arg === "--source" && args[i + 1]) {
      options.source = args[++i];
    } else if (arg.startsWith("--source=")) {
      options.source = arg.split("=").slice(1).join("=");
    }

    i++;
  }

  return { options, help };
}

function showCreateHelp(): void {
  console.log(`ec link create - Create a new link

Usage: ec link create [options]
       ec link create --file <path>

Options:
  --file <path>       Create from markdown file with frontmatter
  --url <url>         External URL (required)
  --slug <slug>       URL slug (required, lowercase letters, numbers, hyphens)
  --content <text>    Your commentary in markdown (required unless --file)
  --title <title>     Optional title
  --excerpt <text>    Short excerpt/summary
  --tags <tags>       Comma-separated list of tags
  --source <id>       Source ID (e.g., Hacker News, Reddit)
  --json              Output as JSON
  --help, -h          Show this help message

File-based creation:
  When using --file, frontmatter fields (url, slug, title, tags, excerpt, source, banner)
  are extracted from the markdown file. Command-line options override frontmatter.

Examples:
  ec link create --url "https://example.com" --slug cool-article --content "Worth reading"
  ec link create --file link.md
  ec link create --url "https://..." --slug my-link --content "..." --source 1
`);
}

export async function create(args: string[], globalOptions: GlobalOptions): Promise<void> {
  const { options, help } = parseCreateArgs(args);

  if (help) {
    showCreateHelp();
    return;
  }

  const config = await loadConfig();
  const apiUrl = globalOptions.apiUrl || config.api_url;
  const apiKey = globalOptions.apiKey || config.api_key;

  if (!apiUrl || !apiKey) {
    console.error("❌ Not configured. Run 'ec login' first.");
    process.exit(1);
  }

  const client = new ApiClient(apiUrl, apiKey);

  // Determine values from file or options
  let url = options.url;
  let title = options.title;
  let slug = options.slug;
  let content = options.content;
  let excerpt = options.excerpt;
  let tags = options.tags;
  let source = options.source;
  let banner: string | undefined;
  let bannerImageId: number | undefined;

  if (options.file) {
    // File-based creation
    const filePath = path.resolve(options.file);

    if (!fs.existsSync(filePath)) {
      console.error(`❌ File not found: ${options.file}`);
      process.exit(1);
    }

    const fileContent = fs.readFileSync(filePath, "utf-8");
    const basePath = path.dirname(filePath);
    const { frontmatter, content: bodyContent } = parseMarkdown(fileContent);

    // Use frontmatter values, allow CLI overrides
    url = options.url ?? frontmatter.url;
    title = options.title ?? frontmatter.title;
    slug = options.slug ?? frontmatter.slug;
    excerpt = options.excerpt ?? frontmatter.excerpt;
    source = options.source ?? frontmatter.source;
    banner = frontmatter.banner;

    // Merge tags: CLI tags override, or use frontmatter
    tags = options.tags ?? frontmatter.tags;

    // Process images
    const imageRefs = detectImages(banner, bodyContent, basePath);
    const localImages = imageRefs.filter((r) => r.type === "local" || r.type === "id");

    if (localImages.length > 0) {
      if (!slug) {
        console.error("❌ Slug is required before uploading images.");
        console.error("   Add 'slug:' to frontmatter or use --slug option.");
        process.exit(1);
      }

      console.log(`📤 Processing ${localImages.length} image(s)...`);

      try {
        const { urlMap, idMap } = await processImages(imageRefs, slug, client);

        // Rewrite content
        content = rewriteContent(bodyContent, urlMap);

        // Get banner image ID if banner was processed
        if (banner && idMap.has(banner)) {
          bannerImageId = idMap.get(banner);
        }
      } catch (error) {
        console.error(`❌ Image processing failed: ${error}`);
        process.exit(1);
      }
    } else {
      content = bodyContent;
    }
  }

  // Validate required fields
  if (!url) {
    console.error("❌ Missing required option: --url");
    console.error("   Or add 'url:' to frontmatter when using --file");
    process.exit(1);
  }

  if (!slug) {
    console.error("❌ Missing required option: --slug");
    console.error("   Or add 'slug:' to frontmatter when using --file");
    process.exit(1);
  }

  if (!content) {
    console.error("❌ Missing required option: --content");
    console.error("   Or provide content in markdown file when using --file");
    process.exit(1);
  }

  // Parse source ID if provided
  const sourceId = source ? parseInt(source, 10) : undefined;
  if (source && (isNaN(sourceId!) || sourceId! <= 0)) {
    console.error("❌ Invalid source ID. Must be a positive integer.");
    process.exit(1);
  }

  const result = await client.createPost({
    type: "link",
    slug,
    url,
    title,
    content,
    excerpt,
    tags,
    source_id: sourceId,
    banner_image_id: bannerImageId,
  });

  if (result.error) {
    console.error(`❌ Error: ${result.error}`);
    process.exit(1);
  }

  const post = result.data!;

  if (globalOptions.json) {
    console.log(JSON.stringify(post, null, 2));
  } else {
    console.log(`✅ Link created: ${post.slug}`);
    console.log(`   URL: ${url}`);
    if (post.title) {
      console.log(`   Title: ${post.title}`);
    }
    console.log(`   Status: draft`);
    if (post.tags.length > 0) {
      console.log(`   Tags: ${post.tags.join(", ")}`);
    }
    if (options.file) {
      console.log(`   Source: ${options.file}`);
    }
  }
}
