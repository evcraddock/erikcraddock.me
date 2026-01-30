import * as fs from "fs";
import * as path from "path";
import type { GlobalOptions } from "../../types";
import { ApiClient } from "../../lib/api";
import { loadConfig } from "../../lib/config";

export interface UploadOptions {
  alt?: string;
  key?: string;
  post?: string;
}

export const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp"];

export function parseUploadArgs(args: string[]): {
  file: string | null;
  options: UploadOptions;
  help: boolean;
} {
  let file: string | null = null;
  const options: UploadOptions = {};
  let help = false;

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg === "--help" || arg === "-h") {
      help = true;
    } else if (arg === "--alt" && args[i + 1]) {
      options.alt = args[++i];
    } else if (arg.startsWith("--alt=")) {
      options.alt = arg.split("=").slice(1).join("=");
    } else if (arg === "--key" && args[i + 1]) {
      options.key = args[++i];
    } else if (arg.startsWith("--key=")) {
      options.key = arg.split("=").slice(1).join("=");
    } else if (arg === "--post" && args[i + 1]) {
      options.post = args[++i];
    } else if (arg.startsWith("--post=")) {
      options.post = arg.split("=").slice(1).join("=");
    } else if (!arg.startsWith("-") && file === null) {
      file = arg;
    }

    i++;
  }

  return { file, options, help };
}

export function showUploadHelp(): void {
  console.log(`ec image upload - Upload an image

Usage: ec image upload <file> [options]

Arguments:
  <file>            Path to the image file

Options:
  --alt <text>      Alt text for the image
  --key <path>      Custom S3 key path
  --post <slug>     Associate with a post (sets key to posts/<slug>/<filename>)
  --json            Output as JSON
  --help, -h        Show this help message

When --post and --key are both provided, the key becomes: posts/<slug>/<key>

Supported formats: jpg, jpeg, png, gif, webp

Examples:
  ec image upload ./photo.jpg
  ec image upload ./photo.jpg --alt "A beautiful sunset"
  ec image upload ./photo.jpg --post my-post
  ec image upload ./photo.jpg --post my-post --key banner.jpg
  ec image upload ./photo.jpg --key "custom/path/image.jpg"
`);
}

export function resolveKey(
  filePath: string,
  options: { key?: string; post?: string }
): string | undefined {
  const filename = path.basename(filePath);

  if (options.post && options.key) {
    // --post my-post --key banner.jpg → posts/my-post/banner.jpg
    return `posts/${options.post}/${options.key}`;
  }

  if (options.post) {
    // --post my-post → posts/my-post/photo.jpg
    return `posts/${options.post}/${filename}`;
  }

  if (options.key) {
    // --key custom/path.jpg → custom/path.jpg
    return options.key;
  }

  // No key specified, let API auto-generate
  return undefined;
}

export function validateFile(filePath: string): string | null {
  if (!fs.existsSync(filePath)) {
    return `File not found: ${filePath}`;
  }

  const ext = path.extname(filePath).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return `Unsupported file format: ${ext}. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`;
  }

  return null;
}

export async function upload(args: string[], globalOptions: GlobalOptions): Promise<void> {
  const { file, options, help } = parseUploadArgs(args);

  if (help) {
    showUploadHelp();
    return;
  }

  if (!file) {
    console.error("❌ File path is required.");
    console.error("Usage: ec image upload <file>");
    process.exit(1);
  }

  const validationError = validateFile(file);
  if (validationError) {
    console.error(`❌ ${validationError}`);
    process.exit(1);
  }

  const config = await loadConfig(globalOptions.configPath);
  const apiUrl = globalOptions.apiUrl || config.api_url;
  const apiKey = globalOptions.apiKey || config.api_key;

  if (!apiUrl || !apiKey) {
    console.error("❌ Not configured. Run 'ec login' first.");
    process.exit(1);
  }

  const key = resolveKey(file, options);
  const client = new ApiClient(apiUrl, apiKey);
  const result = await client.uploadMedia(file, { key, alt: options.alt });

  if (result.error) {
    console.error(`❌ Error: ${result.error}`);
    process.exit(1);
  }

  const media = result.data!;

  if (globalOptions.json) {
    console.log(
      JSON.stringify(
        {
          id: media.id,
          url: media.url,
          key: media.s3_key,
          filename: media.filename,
          mime_type: media.mime_type,
        },
        null,
        2
      )
    );
  } else {
    console.log(`✅ Uploaded image`);
    console.log(`   ID:   ${media.id}`);
    console.log(`   URL:  ${media.url}`);
    console.log(`   Key:  ${media.s3_key}`);
  }
}
