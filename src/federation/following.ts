import { and, asc, eq, inArray } from "drizzle-orm";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { Follow, type Recipient } from "@fedify/fedify";

import * as schema from "@/db/schema";
import { people, personSocialAccounts, remoteFollows } from "@/db/schema";
import { logger } from "@/utils/logger";
import { baseUrl, dateToInstant } from "./utils";

export const REMOTE_FOLLOW_PENDING_STATUS = "pending";
export const REMOTE_FOLLOW_ACCEPTED_STATUS = "accepted";
export const REMOTE_FOLLOW_REJECTED_STATUS = "rejected";
export const REMOTE_FOLLOW_FAILED_STATUS = "failed";
export const REMOTE_FOLLOW_CANCELLED_STATUS = "cancelled";

export type RemoteFollowStatus =
  | typeof REMOTE_FOLLOW_PENDING_STATUS
  | typeof REMOTE_FOLLOW_ACCEPTED_STATUS
  | typeof REMOTE_FOLLOW_REJECTED_STATUS
  | typeof REMOTE_FOLLOW_FAILED_STATUS
  | typeof REMOTE_FOLLOW_CANCELLED_STATUS;

type FollowingDatabase = BunSQLiteDatabase<typeof schema>;
export type RemoteFollow = typeof remoteFollows.$inferSelect;

function getDefaultDatabase(): FollowingDatabase {
  // Keep the production database import lazy so tests that inject an in-memory DB
  // do not open ./data/site.db at module load time.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("@/db").db as FollowingDatabase;
}

type FetchLike = typeof fetch;

export interface ResolvedRemoteActor {
  actorUri: string;
  handle: string | null;
  preferredUsername: string | null;
  displayName: string | null;
  profileUrl: string | null;
  inboxUri: string;
  sharedInboxUri: string | null;
  avatarUrl: string | null;
}

interface WebFingerLink {
  rel?: string;
  type?: string;
  href?: string;
}

interface WebFingerResponse {
  subject?: string;
  aliases?: string[];
  links?: WebFingerLink[];
}

interface ActorDocument {
  id?: string;
  preferredUsername?: string;
  name?: string;
  url?: string | { href?: string } | Array<string | { href?: string }>;
  inbox?: string;
  endpoints?: { sharedInbox?: string };
  icon?: { url?: string } | string | Array<{ url?: string } | string>;
}

export function parseFediverseHandle(input: string): { username: string; host: string } | null {
  const normalized = input.trim().replace(/^@/, "");
  if (!normalized || normalized.includes("://")) return null;

  const [username, host, extra] = normalized.split("@");
  if (!username || !host || extra) return null;
  if (!/^[A-Za-z0-9._-]+$/.test(username)) return null;

  try {
    const url = new URL(`https://${host}`);
    if (!isSafeRemoteUrl(url)) return null;
    return { username, host: url.hostname.toLowerCase() };
  } catch {
    return null;
  }
}

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split(".").map((part) => Number(part));
  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return false;
  }

  const [a, b] = parts;
  return (
    a === 10 ||
    a === 127 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254) ||
    a === 0
  );
}

export function isSafeRemoteUrl(url: URL): boolean {
  if (url.protocol !== "https:") return false;

  const hostname = url.hostname.toLowerCase();
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "0.0.0.0" ||
    hostname === "::1" ||
    hostname.startsWith("127.") ||
    hostname.startsWith("[::1]") ||
    isPrivateIpv4(hostname)
  ) {
    return false;
  }

  return true;
}

async function fetchJson<T>(url: URL, fetcher: FetchLike): Promise<T> {
  if (!isSafeRemoteUrl(url)) {
    throw new Error(`Unsafe remote URL: ${url.href}`);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetcher(url, {
      headers: { Accept: "application/activity+json, application/ld+json, application/json" },
      redirect: "error",
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Fetch failed for ${url.href}: ${response.status}`);
    }

    const text = await response.text();
    if (text.length > 1_000_000) {
      throw new Error(`Response too large for ${url.href}`);
    }

    return JSON.parse(text) as T;
  } finally {
    clearTimeout(timeout);
  }
}

function firstUrl(value: ActorDocument["url"]): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const candidate = typeof item === "string" ? item : item.href;
      if (candidate) return candidate;
    }
    return null;
  }
  return value.href ?? null;
}

function firstIconUrl(value: ActorDocument["icon"]): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const candidate = typeof item === "string" ? item : item.url;
      if (candidate) return candidate;
    }
    return null;
  }
  return value.url ?? null;
}

function validateRemoteUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return isSafeRemoteUrl(url) ? url.href : null;
  } catch {
    return null;
  }
}

export async function resolveRemoteActor(
  input: string,
  fetcher: FetchLike = fetch
): Promise<ResolvedRemoteActor> {
  let directActorUrl: URL | null = null;
  if (input.trim().includes("://")) {
    try {
      directActorUrl = new URL(input.trim());
    } catch {
      throw new Error("Actor URL is invalid");
    }
  }
  const parsed = directActorUrl ? null : parseFediverseHandle(input);
  if (!parsed && !directActorUrl) {
    throw new Error("Enter a Fediverse handle like @alice@example.social");
  }

  let actorUrl: URL;
  let handle: string | null = null;
  let fallbackUsername: string | null = null;

  if (directActorUrl) {
    if (!isSafeRemoteUrl(directActorUrl)) {
      throw new Error("Actor URL is not safe to fetch");
    }
    actorUrl = directActorUrl;
  } else {
    const resource = `acct:${parsed!.username}@${parsed!.host}`;
    const webFingerUrl = new URL(`https://${parsed!.host}/.well-known/webfinger`);
    webFingerUrl.searchParams.set("resource", resource);

    const webFinger = await fetchJson<WebFingerResponse>(webFingerUrl, fetcher);
    const selfLink = webFinger.links?.find(
      (link) =>
        link.rel === "self" &&
        link.href &&
        (!link.type || link.type.includes("activity") || link.type.includes("ld+json"))
    );

    if (!selfLink?.href) {
      throw new Error("Could not find an ActivityPub actor for that handle");
    }

    actorUrl = new URL(selfLink.href);
    handle = `@${parsed!.username}@${parsed!.host}`;
    fallbackUsername = parsed!.username;
  }

  if (!isSafeRemoteUrl(actorUrl)) {
    throw new Error("Resolved actor URL is not safe to fetch");
  }

  const actor = await fetchJson<ActorDocument>(actorUrl, fetcher);
  const actorUri = validateRemoteUrl(actor.id ?? actorUrl.href);
  const inboxUri = validateRemoteUrl(actor.inbox ?? null);
  if (!actorUri || !inboxUri) {
    throw new Error("Resolved actor is missing a safe id or inbox");
  }

  const profileUrl = validateRemoteUrl(firstUrl(actor.url)) ?? actorUri;
  const avatarUrl = validateRemoteUrl(firstIconUrl(actor.icon));
  const preferredUsername = actor.preferredUsername ?? fallbackUsername;

  return {
    actorUri,
    handle,
    preferredUsername,
    displayName: actor.name ?? preferredUsername,
    profileUrl,
    inboxUri,
    sharedInboxUri: validateRemoteUrl(actor.endpoints?.sharedInbox ?? null),
    avatarUrl,
  };
}

function statusLabel(status: string): string {
  switch (status) {
    case REMOTE_FOLLOW_ACCEPTED_STATUS:
      return "Following";
    case REMOTE_FOLLOW_REJECTED_STATUS:
      return "Rejected";
    case REMOTE_FOLLOW_FAILED_STATUS:
      return "Failed";
    case REMOTE_FOLLOW_CANCELLED_STATUS:
      return "Cancelled";
    default:
      return "Pending";
  }
}

export function getRemoteFollowStatusLabel(status: string): string {
  return statusLabel(status);
}

function findPersonIdForActor(
  actor: ResolvedRemoteActor,
  database: FollowingDatabase
): number | null {
  const candidates = [actor.actorUri, actor.profileUrl, actor.handle].filter(
    (value): value is string => Boolean(value)
  );
  if (candidates.length === 0) return null;

  const match = database
    .select({ personId: personSocialAccounts.person_id })
    .from(personSocialAccounts)
    .where(
      and(
        eq(personSocialAccounts.is_activitypub, true),
        inArray(personSocialAccounts.url, candidates)
      )
    )
    .get();

  return match?.personId ?? null;
}

function ensurePersonForActor(actor: ResolvedRemoteActor, database: FollowingDatabase): number {
  const existingPersonId = findPersonIdForActor(actor, database);
  if (existingPersonId) return existingPersonId;

  const name = actor.displayName ?? actor.preferredUsername ?? actor.handle ?? actor.actorUri;
  const person = database
    .insert(people)
    .values({ name, url: actor.profileUrl ?? actor.actorUri })
    .returning()
    .get();

  database
    .insert(personSocialAccounts)
    .values({
      person_id: person.id,
      label: actor.handle ?? "Fediverse",
      url: actor.profileUrl ?? actor.actorUri,
      avatar_url: actor.avatarUrl,
      is_activitypub: true,
      is_default: true,
      sort_order: 0,
    })
    .run();

  return person.id;
}

function followActivityUri(actorUri: string): string {
  const encoded = encodeURIComponent(actorUri).replace(/%/g, "~");
  return new URL(`/activities/follow/${encoded}`, baseUrl).href;
}

export async function sendFollowActivity(follow: RemoteFollow): Promise<void> {
  const { federation } = await import("./setup");
  const ctx = federation.createContext(new URL(baseUrl), undefined);
  const actorUri = ctx.getActorUri("erik");
  const activity = new Follow({
    id: new URL(follow.follow_activity_uri),
    actor: actorUri,
    object: new URL(follow.actor_uri),
    to: new URL(follow.actor_uri),
    published: dateToInstant(follow.followed_at),
  });
  const recipient: Recipient = {
    id: new URL(follow.actor_uri),
    inboxId: new URL(follow.inbox_uri),
    endpoints: follow.shared_inbox_uri ? { sharedInbox: new URL(follow.shared_inbox_uri) } : null,
  };

  await ctx.sendActivity({ identifier: "erik" }, recipient, activity, { preferSharedInbox: true });
}

export async function createOrRetryRemoteFollow({
  actor,
  database = getDefaultDatabase(),
  deliver = sendFollowActivity,
}: {
  actor: ResolvedRemoteActor;
  database?: FollowingDatabase;
  deliver?: (follow: RemoteFollow) => Promise<void>;
}): Promise<RemoteFollow> {
  const existing = database
    .select()
    .from(remoteFollows)
    .where(eq(remoteFollows.actor_uri, actor.actorUri))
    .get();

  if (existing) {
    logger.debug("federation", `Remote follow already exists: ${actor.actorUri}`);
    return existing;
  }

  const now = new Date();
  const personId = ensurePersonForActor(actor, database);
  const follow = database
    .insert(remoteFollows)
    .values({
      person_id: personId,
      actor_uri: actor.actorUri,
      handle: actor.handle,
      preferred_username: actor.preferredUsername,
      display_name: actor.displayName,
      profile_url: actor.profileUrl,
      inbox_uri: actor.inboxUri,
      shared_inbox_uri: actor.sharedInboxUri,
      avatar_url: actor.avatarUrl,
      follow_activity_uri: followActivityUri(actor.actorUri),
      status: REMOTE_FOLLOW_PENDING_STATUS,
      last_error: null,
      followed_at: now,
      created_at: now,
      updated_at: now,
    })
    .returning()
    .get();

  try {
    await deliver(follow);
    return follow;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    database
      .update(remoteFollows)
      .set({ status: REMOTE_FOLLOW_FAILED_STATUS, last_error: message, updated_at: new Date() })
      .where(eq(remoteFollows.id, follow.id))
      .run();
    throw error;
  }
}

export function listRemoteFollows(
  database: FollowingDatabase = getDefaultDatabase()
): RemoteFollow[] {
  return database
    .select()
    .from(remoteFollows)
    .orderBy(asc(remoteFollows.display_name), asc(remoteFollows.id))
    .all();
}

export function getRemoteFollowForActor(
  actorUri: string,
  database: FollowingDatabase = getDefaultDatabase()
): RemoteFollow | null {
  return (
    database.select().from(remoteFollows).where(eq(remoteFollows.actor_uri, actorUri)).get() ?? null
  );
}

export function getRemoteFollowForPerson(
  personId: number,
  database: FollowingDatabase = getDefaultDatabase()
): RemoteFollow | null {
  return (
    database.select().from(remoteFollows).where(eq(remoteFollows.person_id, personId)).get() ?? null
  );
}
