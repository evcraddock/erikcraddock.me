import { Endpoints, Image, Person, PropertyValue, Update, type ActorKeyPair } from "@fedify/fedify";

const ACTOR_NAME = "Erik Craddock";
const ACTOR_SUMMARY = "Writer, coder, and musician — not always in that order.";

export interface ActorProfileField {
  name: string;
  href: string;
  text: string;
}

const PUBLIC_PROFILE_FIELDS: ActorProfileField[] = [
  { name: "Website", href: "/", text: "erikcraddock.me" },
  { name: "GitHub", href: "https://github.com/evcraddock", text: "github.com/evcraddock" },
  {
    name: "LinkedIn",
    href: "https://www.linkedin.com/in/erik-craddock-42aa9815",
    text: "linkedin.com/in/erik-craddock-42aa9815",
  },
  { name: "YouTube", href: "https://youtube.com/@ErikCraddock", text: "youtube.com/@ErikCraddock" },
];

export interface ActorProfileUris {
  actor: URL;
  inbox: URL;
  outbox: URL;
  followers: URL;
  following: URL;
  sharedInbox: URL;
}

export interface BuildActorProfileOptions {
  identifier: string;
  canonicalOrigin: string | URL;
  uris: ActorProfileUris;
  keys: ActorKeyPair[];
}

export interface BuildActorUpdateOptions extends BuildActorProfileOptions {
  activityId: URL;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function resolveProfileFieldUrl(field: ActorProfileField, canonicalOrigin: string | URL): URL {
  return new URL(field.href, canonicalOrigin);
}

export function getPublicProfileFields(canonicalOrigin: string | URL): ActorProfileField[] {
  return PUBLIC_PROFILE_FIELDS.map((field) => ({
    ...field,
    href: resolveProfileFieldUrl(field, canonicalOrigin).toString(),
  }));
}

function profileFieldToHtml(field: ActorProfileField, canonicalOrigin: string | URL): string {
  const href = resolveProfileFieldUrl(field, canonicalOrigin).toString();
  return `<a href="${escapeHtml(href)}" rel="me">${escapeHtml(field.text)}</a>`;
}

export function buildActorMetadata(canonicalOrigin: string | URL): PropertyValue[] {
  return PUBLIC_PROFILE_FIELDS.map(
    (field) =>
      new PropertyValue({
        name: field.name,
        value: profileFieldToHtml(field, canonicalOrigin),
      })
  );
}

export function buildActorProfile(options: BuildActorProfileOptions): Person {
  const { identifier, canonicalOrigin, uris, keys } = options;
  const iconUrl = new URL("/images/erik-logo.png", canonicalOrigin);
  const bannerUrl = new URL("/images/banner.png", canonicalOrigin);

  return new Person({
    id: uris.actor,
    preferredUsername: identifier,
    name: ACTOR_NAME,
    summary: ACTOR_SUMMARY,
    icon: new Image({ url: iconUrl, mediaType: "image/png" }),
    image: new Image({ url: bannerUrl, mediaType: "image/png" }),
    url: new URL("/", canonicalOrigin),
    inbox: uris.inbox,
    outbox: uris.outbox,
    followers: uris.followers,
    following: uris.following,
    endpoints: new Endpoints({ sharedInbox: uris.sharedInbox }),
    publicKey: keys[0]?.cryptographicKey,
    assertionMethods: keys.map((key) => key.multikey),
    attachments: buildActorMetadata(canonicalOrigin),
  });
}

export function buildActorUpdateActivity(options: BuildActorUpdateOptions): Update {
  return new Update({
    id: options.activityId,
    actor: options.uris.actor,
    object: buildActorProfile(options),
  });
}
