#!/usr/bin/env bun

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname } from "node:path";
import { spawnSync } from "node:child_process";

export interface LinkListItem {
  slug: string;
  title: string | null;
  url?: string | null;
  source_id: number | null;
  author_id: number | null;
  source?: Source | null;
  author?: Person | null;
}

export interface LinkPost extends LinkListItem {
  content?: string;
  excerpt?: string | null;
  og_title?: string | null;
  og_description?: string | null;
  og_image_url?: string | null;
  og_site_name?: string | null;
}

export interface Source {
  id: number;
  name: string;
  url: string;
  feed_url: string | null;
  authors: Array<{ id: number; name: string; url: string | null; sort_order: number }>;
}

export interface Person {
  id: number;
  name: string;
  url: string | null;
}

interface Options {
  mode: "discover" | "apply";
  planPath: string;
  resultPath: string;
  configPath?: string;
  apiUrl?: string;
  apiKey?: string;
  limit?: number;
  offset: number;
  fetchPages: boolean;
}

export interface ProposedSource {
  name: string;
  url: string;
  feed_url: string | null;
}

export type Confidence = "high" | "ambiguous" | "missing";

export interface PlannedLink {
  slug: string;
  url: string;
  title: string | null;
  current_source_id: number | null;
  current_author_id: number | null;
  proposed_source_id: number | null;
  proposed_author_id: number | null;
  proposed_author: string | null;
  proposed_author_url: string | null;
  confidence: Confidence;
  evidence: string[];
  action: "update-source-and-author" | "update-source" | "update-author" | "skip";
  skipReason?: string;
}

export interface SourceGroupPlan {
  siteKey: string;
  proposedSource: ProposedSource;
  existingSourceId: number | null;
  links: PlannedLink[];
}

export interface BackfillPlan {
  generatedAt: string;
  mode: "discover";
  groups: SourceGroupPlan[];
  ambiguous: PlannedLink[];
  skipped: PlannedLink[];
}

interface PageMetadata {
  siteName: string | null;
  title: string | null;
  authorName: string | null;
  authorUrl: string | null;
  feedUrl: string | null;
  evidence: string[];
}

interface ApplyResult {
  appliedAt: string;
  successes: Array<{ slug: string; source_id?: number; author_id?: number }>;
  skips: Array<{ slug: string; reason: string }>;
  failures: Array<{ slug: string; error: string }>;
  createdSources: Source[];
  updatedSources: Source[];
  createdPeople: Person[];
}

function usage(): string {
  return `Usage: bun scripts/backfill-link-attribution.ts [discover|apply] [options]

Create a reviewed plan for safely backfilling link source_id and author_id via ec.

Modes:
  discover          Build a dry-run plan without mutating data (default)
  apply             Apply a reviewed plan; requires --plan

Options:
  --plan PATH       Plan path (default: tmp/link-attribution-plan.json)
  --result PATH     Apply result path (default: tmp/link-attribution-results.json)
  --config PATH     CLI config file to pass to ec
  --api-url URL     Override API URL for ec
  --api-key KEY     Override API key for ec
  --limit N         Process at most N links during discovery
  --offset N        Skip the first N links during discovery
  --no-fetch        Do not fetch linked pages for metadata
  --help, -h        Show this help

Examples:
  bun scripts/backfill-link-attribution.ts discover --config cli/dev-config.yaml
  bun scripts/backfill-link-attribution.ts discover --limit 10 --offset 10 --plan tmp/link-attribution-plan-2.json
  bun scripts/backfill-link-attribution.ts apply --config cli/dev-config.yaml --plan tmp/link-attribution-plan.json
`;
}

function parseArgs(args: string[]): Options {
  const options: Options = {
    mode: "discover",
    planPath: "tmp/link-attribution-plan.json",
    resultPath: "tmp/link-attribution-results.json",
    offset: 0,
    fetchPages: true,
  };

  let index = 0;
  if (args[0] === "discover" || args[0] === "apply") {
    options.mode = args[0];
    index = 1;
  }

  for (let i = index; i < args.length; i += 1) {
    const arg = args[i];
    const next = args[i + 1];

    if (arg === "--help" || arg === "-h") {
      console.log(usage());
      process.exit(0);
    } else if (arg === "--plan" && next) {
      options.planPath = next;
      i += 1;
    } else if (arg.startsWith("--plan=")) {
      options.planPath = arg.slice("--plan=".length);
    } else if (arg === "--result" && next) {
      options.resultPath = next;
      i += 1;
    } else if (arg.startsWith("--result=")) {
      options.resultPath = arg.slice("--result=".length);
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
    } else if (arg === "--offset" && next) {
      options.offset = parseOffset(next);
      i += 1;
    } else if (arg.startsWith("--offset=")) {
      options.offset = parseOffset(arg.slice("--offset=".length));
    } else if (arg === "--no-fetch") {
      options.fetchPages = false;
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

function parseOffset(value: string): number {
  const offset = Number(value);
  if (!Number.isInteger(offset) || offset < 0) {
    throw new Error("--offset must be an integer greater than or equal to 0");
  }
  return offset;
}

function cliArgs(options: Options): string[] {
  const args = ["cli/src/index.ts"];
  if (options.configPath) args.push("--config", options.configPath);
  if (options.apiUrl) args.push("--api-url", options.apiUrl);
  if (options.apiKey) args.push("--api-key", options.apiKey);
  return args;
}

function runEcJson<T>(options: Options, args: string[]): T {
  const result = spawnSync("bun", [...cliArgs(options), "--json", ...args], { encoding: "utf-8" });
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || result.stdout.trim() || `ec exited ${result.status}`);
  }
  return JSON.parse(result.stdout) as T;
}

function writeJson(path: string, data: unknown): void {
  const directory = dirname(path);
  if (directory && directory !== "." && !existsSync(directory)) {
    mkdirSync(directory, { recursive: true });
  }
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
}

export function normalizeHostname(input: string): string | null {
  try {
    const url = new URL(input);
    return url.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function sourceOrigin(input: string): string {
  const url = new URL(input);
  return `${url.protocol}//${url.hostname}/`;
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function findExistingSource(sources: Source[], siteKey: string): Source | null {
  return sources.find((source) => normalizeHostname(source.url) === siteKey) ?? null;
}

function findExistingPerson(people: Person[], name: string | null): Person | null {
  if (!name) return null;
  const normalized = normalizeName(name);
  return people.find((person) => normalizeName(person.name) === normalized) ?? null;
}

function sourceNameFromLink(
  link: LinkPost,
  metadata: PageMetadata | null,
  siteKey: string
): string {
  return decodeHtml(
    link.source?.name ?? link.og_site_name ?? metadata?.siteName ?? metadata?.title ?? siteKey
  );
}

export function inferAuthor(
  link: LinkPost,
  metadata: PageMetadata | null
): {
  name: string | null;
  url: string | null;
  confidence: Confidence;
  evidence: string[];
} {
  const evidence: string[] = [];

  if (metadata?.authorName) {
    return {
      name: metadata.authorName,
      url: metadata.authorUrl,
      confidence: "high",
      evidence: metadata.evidence,
    };
  }

  const title = link.title ?? link.og_title ?? "";
  const bylineMatch = title.match(/(?:^|[-–—|:])\s*by\s+([^|–—-]+)$/i);
  if (bylineMatch?.[1]) {
    evidence.push("title_byline");
    return { name: bylineMatch[1].trim(), url: null, confidence: "high", evidence };
  }

  const siteKey = link.url ? normalizeHostname(link.url) : null;
  const knownSiteAuthor = siteKey ? knownAuthorForSite(siteKey) : null;
  if (knownSiteAuthor) {
    evidence.push("known_site_rule");
    return { name: knownSiteAuthor, url: null, confidence: "high", evidence };
  }

  return { name: null, url: null, confidence: "missing", evidence: [] };
}

function knownAuthorForSite(siteKey: string): string | null {
  const rules: Record<string, string> = {
    "oneusefulthing.org": "Ethan Mollick",
    "simonwillison.net": "Simon Willison",
  };
  return rules[siteKey] ?? null;
}

async function fetchMetadata(url: string, enabled: boolean): Promise<PageMetadata | null> {
  if (!enabled) return null;

  try {
    await new Promise((resolve) => setTimeout(resolve, 250));
    const response = await fetch(url, {
      headers: { "user-agent": "erikcraddock.me attribution backfill" },
    });
    const contentType = response.headers.get("content-type") ?? "";
    if (!response.ok || !contentType.toLowerCase().includes("text/html")) {
      return null;
    }
    return parseMetadata(await response.text(), url);
  } catch {
    return null;
  }
}

export function parseMetadata(html: string, pageUrl?: string): PageMetadata {
  const siteName = firstMeta(html, ["og:site_name"]);
  const title = firstMeta(html, ["og:title"]) ?? firstTagContent(html, "title");
  const feedUrl = firstFeedUrl(html, pageUrl);
  const metaAuthor = firstMeta(html, ["author", "article:author"]);
  const jsonLdAuthor = extractJsonLdAuthor(html);

  if (jsonLdAuthor.name) {
    return {
      siteName,
      title,
      authorName: jsonLdAuthor.name,
      authorUrl: jsonLdAuthor.url,
      feedUrl,
      evidence: ["json_ld_author"],
    };
  }

  if (metaAuthor) {
    return {
      siteName,
      title,
      authorName: metaAuthor,
      authorUrl: null,
      feedUrl,
      evidence: ["meta_author"],
    };
  }

  return { siteName, title, authorName: null, authorUrl: null, feedUrl, evidence: [] };
}

function firstMeta(html: string, names: string[]): string | null {
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regexes = [
      new RegExp(
        `<meta[^>]+(?:name|property)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`,
        "i"
      ),
      new RegExp(
        `<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${escaped}["'][^>]*>`,
        "i"
      ),
    ];
    for (const regex of regexes) {
      const match = html.match(regex);
      if (match?.[1]) return decodeHtml(match[1].trim());
    }
  }
  return null;
}

function firstFeedUrl(html: string, pageUrl?: string): string | null {
  const linkRegex = /<link\b[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = linkRegex.exec(html)) !== null) {
    const tag = match[0];
    const rel = attributeValue(tag, "rel")?.toLowerCase() ?? "";
    const type = attributeValue(tag, "type")?.toLowerCase() ?? "";
    const href = attributeValue(tag, "href");
    if (!href || !rel.split(/\s+/).includes("alternate")) continue;
    if (!type.includes("rss") && !type.includes("atom") && !type.includes("feed")) continue;
    try {
      return pageUrl ? new URL(decodeHtml(href), pageUrl).toString() : decodeHtml(href);
    } catch {
      return decodeHtml(href);
    }
  }
  return null;
}

function attributeValue(tag: string, attribute: string): string | null {
  const escaped = attribute.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = tag.match(new RegExp(`${escaped}=["']([^"']+)["']`, "i"));
  return match?.[1] ? decodeHtml(match[1].trim()) : null;
}

function firstTagContent(html: string, tag: string): string | null {
  const match = html.match(new RegExp(`<${tag}[^>]*>([^<]+)</${tag}>`, "i"));
  return match?.[1] ? decodeHtml(match[1].trim()) : null;
}

function extractJsonLdAuthor(html: string): { name: string | null; url: string | null } {
  const regex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim()) as unknown;
      const author = findAuthorInJsonLd(parsed);
      if (author.name) return author;
    } catch {
      // Ignore malformed JSON-LD.
    }
  }
  return { name: null, url: null };
}

function findAuthorInJsonLd(value: unknown): { name: string | null; url: string | null } {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findAuthorInJsonLd(item);
      if (found.name) return found;
    }
    return { name: null, url: null };
  }

  if (!value || typeof value !== "object") return { name: null, url: null };
  const record = value as Record<string, unknown>;
  const author = record.author;
  if (typeof author === "string") return { name: author, url: null };
  if (Array.isArray(author)) return findAuthorInJsonLd(author[0]);
  if (author && typeof author === "object") {
    const authorRecord = author as Record<string, unknown>;
    return {
      name: typeof authorRecord.name === "string" ? authorRecord.name : null,
      url: typeof authorRecord.url === "string" ? authorRecord.url : null,
    };
  }

  return { name: null, url: null };
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#039;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

export async function buildPlan(input: {
  links: LinkListItem[];
  sources: Source[];
  people: Person[];
  fetchPages: boolean;
  limit?: number;
  offset?: number;
  loadLink: (slug: string) => LinkPost;
}): Promise<BackfillPlan> {
  const groups = new Map<string, SourceGroupPlan>();
  const ambiguous: PlannedLink[] = [];
  const skipped: PlannedLink[] = [];
  const start = input.offset ?? 0;
  const end = input.limit ? start + input.limit : undefined;
  const selectedLinks = input.links.slice(start, end);

  for (const item of selectedLinks) {
    const link = input.loadLink(item.slug);
    if (!link.url) {
      skipped.push(skippedLink(link, "missing-url"));
      continue;
    }

    const siteKey = normalizeHostname(link.url);
    if (!siteKey) {
      skipped.push(skippedLink(link, "invalid-url"));
      continue;
    }

    const metadata = await fetchMetadata(link.url, input.fetchPages);
    const existingSource = link.source ?? findExistingSource(input.sources, siteKey);
    const author = inferAuthor(link, metadata);
    const existingPerson = findExistingPerson(input.people, author.name);
    const proposedSource: ProposedSource = {
      name: sourceNameFromLink(link, metadata, siteKey),
      url: existingSource?.url ?? sourceOrigin(link.url),
      feed_url: existingSource?.feed_url ?? metadata?.feedUrl ?? null,
    };

    const planned: PlannedLink = {
      slug: link.slug,
      url: link.url,
      title: link.title,
      current_source_id: link.source_id,
      current_author_id: link.author_id,
      proposed_source_id: existingSource?.id ?? null,
      proposed_author_id: existingPerson?.id ?? null,
      proposed_author: author.name,
      proposed_author_url: author.url,
      confidence: author.confidence,
      evidence: author.evidence,
      action: determineAction(link, author),
    };

    if (author.confidence !== "high" && !link.author_id) {
      ambiguous.push(planned);
    }

    if (planned.action === "skip") {
      skipped.push({ ...planned, skipReason: "already-attributed-or-no-confident-update" });
    }

    const group = groups.get(siteKey) ?? {
      siteKey,
      proposedSource,
      existingSourceId: existingSource?.id ?? null,
      links: [],
    };
    group.links.push(planned);
    groups.set(siteKey, group);
  }

  return {
    generatedAt: new Date().toISOString(),
    mode: "discover",
    groups: Array.from(groups.values()).sort((a, b) => a.siteKey.localeCompare(b.siteKey)),
    ambiguous,
    skipped,
  };
}

function determineAction(
  link: LinkPost,
  author: { confidence: Confidence; name: string | null }
): PlannedLink["action"] {
  const needsSource = !link.source_id;
  const needsAuthor = !link.author_id && author.confidence === "high" && Boolean(author.name);
  if (needsSource && needsAuthor) return "update-source-and-author";
  if (needsSource) return "update-source";
  if (needsAuthor) return "update-author";
  return "skip";
}

function skippedLink(link: LinkPost, reason: string): PlannedLink {
  return {
    slug: link.slug,
    url: link.url ?? "",
    title: link.title,
    current_source_id: link.source_id,
    current_author_id: link.author_id,
    proposed_source_id: null,
    proposed_author_id: null,
    proposed_author: null,
    proposed_author_url: null,
    confidence: "missing",
    evidence: [],
    action: "skip",
    skipReason: reason,
  };
}

async function discover(options: Options): Promise<void> {
  const links = runEcJson<LinkListItem[]>(options, ["link", "list"]);
  const sources = runEcJson<Source[]>(options, ["source", "list"]);
  const people = runEcJson<Person[]>(options, ["person", "list"]);
  const plan = await buildPlan({
    links,
    sources,
    people,
    fetchPages: options.fetchPages,
    limit: options.limit,
    offset: options.offset,
    loadLink: (slug) => runEcJson<LinkPost>(options, ["link", "show", slug]),
  });

  writeJson(options.planPath, plan);
  console.log(`Wrote discovery plan: ${options.planPath}`);
  console.log(`Groups: ${plan.groups.length}`);
  console.log(`Ambiguous: ${plan.ambiguous.length}`);
  console.log(`Skipped: ${plan.skipped.length}`);
}

async function apply(options: Options): Promise<void> {
  const plan = JSON.parse(await readFile(options.planPath, "utf-8")) as BackfillPlan;
  const result: ApplyResult = {
    appliedAt: new Date().toISOString(),
    successes: [],
    skips: [],
    failures: [],
    createdSources: [],
    updatedSources: [],
    createdPeople: [],
  };

  const sourceBySite = new Map<string, Source>();
  const peopleByName = new Map<string, number>();
  for (const source of runEcJson<Source[]>(options, ["source", "list"])) {
    const siteKey = normalizeHostname(source.url);
    if (siteKey) sourceBySite.set(siteKey, source);
  }
  for (const person of runEcJson<Person[]>(options, ["person", "list"])) {
    peopleByName.set(normalizeName(person.name), person.id);
  }

  for (const group of plan.groups) {
    let source = sourceBySite.get(group.siteKey) ?? null;
    let sourceId = group.existingSourceId ?? source?.id ?? null;
    if (!sourceId && group.links.some((link) => link.action.includes("source"))) {
      try {
        const createSourceArgs = [
          "source",
          "create",
          "--name",
          group.proposedSource.name,
          "--url",
          group.proposedSource.url,
        ];
        if (group.proposedSource.feed_url) {
          createSourceArgs.push("--feed-url", group.proposedSource.feed_url);
        }
        const created = runEcJson<Source>(options, createSourceArgs);
        sourceId = created.id;
        source = created;
        sourceBySite.set(group.siteKey, created);
        result.createdSources.push(created);
      } catch (error) {
        for (const link of group.links)
          result.failures.push({ slug: link.slug, error: String(error) });
        continue;
      }
    }

    if (sourceId && group.proposedSource.feed_url && !source?.feed_url) {
      try {
        const updated = runEcJson<Source>(options, [
          "source",
          "edit",
          String(sourceId),
          "--feed-url",
          group.proposedSource.feed_url,
        ]);
        source = updated;
        sourceBySite.set(group.siteKey, updated);
        result.updatedSources.push(updated);
      } catch (error) {
        for (const link of group.links)
          result.failures.push({
            slug: link.slug,
            error: `source feed update failed: ${String(error)}`,
          });
        continue;
      }
    }

    for (const link of group.links) {
      if (link.action === "skip") {
        result.skips.push({ slug: link.slug, reason: link.skipReason ?? "skip" });
        continue;
      }

      try {
        const args = ["link", "edit", link.slug];
        if (!link.current_source_id && sourceId) args.push("--source", String(sourceId));
        if (!link.current_author_id && link.confidence === "high" && link.proposed_author) {
          const authorId = ensurePerson(options, link, peopleByName, result);
          args.push("--author", String(authorId));
        }
        if (args.length === 3) {
          result.skips.push({ slug: link.slug, reason: "nothing-to-update" });
          continue;
        }
        runEcJson<LinkPost>(options, args);
        result.successes.push({ slug: link.slug, source_id: sourceId ?? undefined });
      } catch (error) {
        result.failures.push({ slug: link.slug, error: String(error) });
      }
    }
  }

  writeJson(options.resultPath, result);
  console.log(`Wrote apply results: ${options.resultPath}`);
  console.log(`Successes: ${result.successes.length}`);
  console.log(`Skips: ${result.skips.length}`);
  console.log(`Failures: ${result.failures.length}`);
}

function ensurePerson(
  options: Options,
  link: PlannedLink,
  peopleByName: Map<string, number>,
  result: ApplyResult
): number {
  if (!link.proposed_author) throw new Error("missing proposed author");
  const key = normalizeName(link.proposed_author);
  const existingId = peopleByName.get(key);
  if (existingId) return existingId;

  const args = ["person", "create", "--name", link.proposed_author];
  if (link.proposed_author_url) args.push("--url", link.proposed_author_url);
  const created = runEcJson<Person>(options, args);
  peopleByName.set(key, created.id);
  result.createdPeople.push(created);
  return created.id;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  if (options.mode === "discover") {
    await discover(options);
  } else {
    await apply(options);
  }
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
