import * as fs from "fs";
import * as path from "path";
import type { GlobalOptions } from "../../types";
import { ApiClient } from "../../lib/api";
import { loadConfig } from "../../lib/config";
import { parseMarkdown } from "../../lib/markdown";
import { detectImages, processImages, rewriteContent } from "../../lib/images";

interface CreateOptions {
  file?: string;
  title?: string;
  slug?: string;
  content?: string;
  excerpt?: string;
  tags?: string[];
  type?: string;
  url?: string;
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
    } else if (arg === "--url" && args[i + 1]) {
      options.url = args[++i];
    } else if (arg.startsWith("--url=")) {
      options.url = arg.split("=").slice(1).join("=");
    }

    i++;
  }

  return { options, help };
}

function showCreateHelp(): void {
  console.log(`ec post create - Create a new post

Usage: ec post create [options]
       ec post create --file <path>

Options:
  --file <path>       Create from markdown file with frontmatter
  --title <title>     Post title (required for articles)
  --slug <slug>       URL slug (required, lowercase letters, numbers, hyphens)
  --content <text>    Post content in markdown (required unless --file)
  --excerpt <text>    Short excerpt/summary
  --tags <tags>       Comma-separated list of tags
  --type <type>       Post type: article, link, note (default: article)
  --url <url>         URL for link posts (required for links)
  --json              Output as JSON
  --help, -h          Show this help message

File-based creation:
  When using --file, frontmatter fields (title, slug, tags, excerpt, type, banner, url)
  are extracted from the markdown file. Command-line options override frontmatter.

  Local images (./path.jpg) are uploaded automatically.
  Image IDs (image:42) are resolved to URLs.

Examples:
  ec post create --title "My Post" --slug my-post --content "# Hello"
  ec post create --file draft.md
  ec post create --file draft.md --tags extra,tags
`);
}

export async function create(args: string[], globalOptions: GlobalOptions): Promise<void> {
  const { options, help } = parseCreateArgs(args);

  if (help) {
    showCreateHelp();
    return;
  }

  const config = await loadConfig(globalOptions.configPath);
  const apiUrl = globalOptions.apiUrl || config.api_url;
  const apiKey = globalOptions.apiKey || config.api_key;

  if (!apiUrl || !apiKey) {
    console.error("❌ Not configured. Run 'ec login' first.");
    process.exit(1);
  }

  const client = new ApiClient(apiUrl, apiKey);

  // Determine values from file or options
  let title = options.title;
  let slug = options.slug;
  let content = options.content;
  let excerpt = options.excerpt;
  let tags = options.tags;
  let type = options.type;
  let url = options.url;
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
    title = options.title ?? frontmatter.title;
    slug = options.slug ?? frontmatter.slug;
    excerpt = options.excerpt ?? frontmatter.excerpt;
    type = options.type ?? frontmatter.type;
    url = options.url ?? frontmatter.url;
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

  const postType = type || "article";

  if (!["article", "link", "note"].includes(postType)) {
    console.error("❌ Invalid type. Must be: article, link, or note");
    process.exit(1);
  }

  if (postType === "article" && !title) {
    console.error("❌ Articles require a title.");
    console.error("   Use --title option or add 'title:' to frontmatter.");
    process.exit(1);
  }

  if (postType === "link" && !url) {
    console.error("❌ Links require a URL.");
    console.error("   Use --url option or add 'url:' to frontmatter.");
    process.exit(1);
  }

  const result = await client.createPost({
    type: postType,
    slug,
    title,
    content,
    excerpt,
    tags,
    url,
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
    console.log(`✅ Post created: ${post.slug}`);
    console.log(`   Title: ${post.title || "(no title)"}`);
    console.log(`   Type: ${post.type}`);
    console.log(`   Status: draft`);
    if (post.tags.length > 0) {
      console.log(`   Tags: ${post.tags.join(", ")}`);
    }
    if (options.file) {
      console.log(`   Source: ${options.file}`);
    }
  }
}
