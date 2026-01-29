import * as fs from "fs";
import * as path from "path";
import type { GlobalOptions } from "../../types";
import { ApiClient } from "../../lib/api";
import { loadConfig } from "../../lib/config";
import { parseMarkdown } from "../../lib/markdown";
import { detectImages, processImages, rewriteContent } from "../../lib/images";

interface CreateOptions {
  file?: string;
  slug?: string;
  content?: string;
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
    } else if (arg === "--slug" && args[i + 1]) {
      options.slug = args[++i];
    } else if (arg.startsWith("--slug=")) {
      options.slug = arg.split("=").slice(1).join("=");
    } else if (arg === "--content" && args[i + 1]) {
      options.content = args[++i];
    } else if (arg.startsWith("--content=")) {
      options.content = arg.split("=").slice(1).join("=");
    }

    i++;
  }

  return { options, help };
}

function showCreateHelp(): void {
  console.log(`ec note create - Create a new note

Usage: ec note create [options]
       ec note create --file <path>

Options:
  --file <path>       Create from markdown file with frontmatter
  --slug <slug>       URL slug (required, lowercase letters, numbers, hyphens)
  --content <text>    Note content in markdown (required unless --file)
  --json              Output as JSON
  --help, -h          Show this help message

File-based creation:
  When using --file, the slug is extracted from frontmatter.
  Command-line options override frontmatter values.

Examples:
  ec note create --slug quick-thought --content "Just a quick thought"
  ec note create --file note.md
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
  let slug = options.slug;
  let content = options.content;
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
    slug = options.slug ?? frontmatter.slug;
    banner = frontmatter.banner;

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

  const result = await client.createPost({
    type: "note",
    slug,
    content,
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
    console.log(`✅ Note created: ${post.slug}`);
    console.log(`   Status: draft`);
    if (options.file) {
      console.log(`   Source: ${options.file}`);
    }
  }
}
