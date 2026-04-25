#!/usr/bin/env bun

import { spawnSync } from "node:child_process";

interface LinkListItem {
  slug: string;
}

interface LinkPost {
  slug: string;
  url: string | null;
  og_title?: string | null;
  og_description?: string | null;
  og_image_url?: string | null;
  og_site_name?: string | null;
}

interface Options {
  configPath?: string;
  apiUrl?: string;
  apiKey?: string;
  dryRun: boolean;
  limit?: number;
}

function usage(): string {
  return `Usage: bun scripts/backfill-link-previews.ts [options]

Backfill missing link preview metadata by re-saving each missing link URL through ec.

Options:
  --config PATH     CLI config file to use
  --api-url URL     Override API URL
  --api-key KEY     Override API key
  --dry-run         Show links that would be updated without changing anything
  --limit N         Process at most N missing links
  --help, -h        Show this help

Examples:
  bun scripts/backfill-link-previews.ts --config cli/dev-config.yaml --dry-run
  bun scripts/backfill-link-previews.ts --config cli/dev-config.yaml --limit 10
`;
}

function parseArgs(args: string[]): Options {
  const options: Options = { dryRun: false };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    const next = args[i + 1];

    if (arg === "--help" || arg === "-h") {
      console.log(usage());
      process.exit(0);
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--config" && next) {
      options.configPath = next;
      i += 1;
    } else if (arg.startsWith("--config=")) {
      options.configPath = arg.slice("--config=".length);
    } else if (arg === "--api-url" && next) {
      options.apiUrl = next;
      i += 1;
    } else if (arg.startsWith("--api-url=")) {
      options.apiUrl = arg.slice("--api-url=".length);
    } else if (arg === "--api-key" && next) {
      options.apiKey = next;
      i += 1;
    } else if (arg.startsWith("--api-key=")) {
      options.apiKey = arg.slice("--api-key=".length);
    } else if (arg === "--limit" && next) {
      options.limit = parseLimit(next);
      i += 1;
    } else if (arg.startsWith("--limit=")) {
      options.limit = parseLimit(arg.slice("--limit=".length));
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  return options;
}

function parseLimit(value: string): number {
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error("--limit must be an integer greater than 0");
  }
  return limit;
}

function cliArgs(options: Options): string[] {
  const args = ["cli/src/index.ts"];
  if (options.configPath) args.push("--config", options.configPath);
  if (options.apiUrl) args.push("--api-url", options.apiUrl);
  if (options.apiKey) args.push("--api-key", options.apiKey);
  return args;
}

function runEcJson<T>(options: Options, args: string[]): T {
  const result = spawnSync("bun", [...cliArgs(options), "--json", ...args], {
    encoding: "utf-8",
  });

  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || result.stdout.trim() || `ec exited ${result.status}`);
  }

  return JSON.parse(result.stdout) as T;
}

function runEc(options: Options, args: string[]): void {
  const result = spawnSync("bun", [...cliArgs(options), ...args], {
    encoding: "utf-8",
    stdio: "pipe",
  });

  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || result.stdout.trim() || `ec exited ${result.status}`);
  }
}

function hasPreview(link: LinkPost): boolean {
  return Boolean(link.og_title || link.og_description || link.og_image_url || link.og_site_name);
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const links = runEcJson<LinkListItem[]>(options, ["link", "list"]);
  let scanned = 0;
  let missing = 0;
  let updated = 0;
  let skipped = 0;

  for (const item of links) {
    const link = runEcJson<LinkPost>(options, ["link", "show", item.slug]);
    scanned += 1;

    if (!link.url || hasPreview(link)) {
      skipped += 1;
      continue;
    }

    if (options.limit !== undefined && missing >= options.limit) {
      skipped += 1;
      continue;
    }

    missing += 1;
    console.log(`${options.dryRun ? "would update" : "updating"}: ${link.slug} (${link.url})`);

    if (!options.dryRun) {
      runEc(options, ["link", "edit", link.slug, "--url", link.url]);
      updated += 1;
    }
  }

  console.log("\nBackfill complete");
  console.log(`Scanned: ${scanned}`);
  console.log(`Missing preview: ${missing}`);
  console.log(`Updated: ${updated}`);
  console.log(`Skipped: ${skipped}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
