import { describe, expect, it } from "bun:test";
import {
  CryptographicKey,
  generateCryptoKeyPair,
  Multikey,
  type ActorKeyPair,
} from "@fedify/fedify";
import {
  buildActorMetadata,
  buildActorProfile,
  buildActorUpdateActivity,
  type ActorProfileUris,
} from "../actor-profile";

const origin = "https://erikcraddock.me";
const actorUri = new URL("/users/erik", origin);
const uris: ActorProfileUris = {
  actor: actorUri,
  inbox: new URL("/users/erik/inbox", origin),
  outbox: new URL("/users/erik/outbox", origin),
  followers: new URL("/users/erik/followers", origin),
  following: new URL("/users/erik/following", origin),
  sharedInbox: new URL("/inbox", origin),
};

async function createTestActorKeyPair(): Promise<ActorKeyPair> {
  const keyPair = await generateCryptoKeyPair("RSASSA-PKCS1-v1_5");
  const keyId = new URL("/users/erik#main-key", origin);

  return {
    ...keyPair,
    keyId,
    cryptographicKey: new CryptographicKey({
      id: keyId,
      owner: actorUri,
      publicKey: keyPair.publicKey,
    }),
    multikey: new Multikey({
      id: new URL("/users/erik#main-key-multikey", origin),
      controller: actorUri,
      publicKey: keyPair.publicKey,
    }),
  };
}

function getAttachments(json: Record<string, unknown>): Record<string, unknown>[] {
  const attachment = json.attachment;
  if (!attachment) {
    return [];
  }

  return Array.isArray(attachment)
    ? (attachment as Record<string, unknown>[])
    : [attachment as Record<string, unknown>];
}

function attachmentMap(json: Record<string, unknown>): Map<string, Record<string, unknown>> {
  return new Map(getAttachments(json).map((attachment) => [String(attachment.name), attachment]));
}

describe("actor profile metadata", () => {
  it("builds Mastodon-compatible PropertyValue profile fields", async () => {
    const metadata = buildActorMetadata(origin);

    expect(metadata).toHaveLength(4);

    const json = await Promise.all(
      metadata.map((propertyValue) => propertyValue.toJsonLd() as Promise<Record<string, unknown>>)
    );

    expect(json[0]).toMatchObject({
      type: "PropertyValue",
      name: "Website",
      value: '<a href="https://erikcraddock.me/" rel="me">erikcraddock.me</a>',
    });
    expect(json[1]).toMatchObject({
      type: "PropertyValue",
      name: "GitHub",
      value: '<a href="https://github.com/evcraddock" rel="me">github.com/evcraddock</a>',
    });
    expect(JSON.stringify(json[0]["@context"])).toContain("schema");
    expect(JSON.stringify(json[0]["@context"])).toContain("PropertyValue");
  });

  it("includes profile metadata attachments without regressing actor URLs or keys", async () => {
    const keys = [await createTestActorKeyPair()];
    const actor = buildActorProfile({ identifier: "erik", canonicalOrigin: origin, uris, keys });
    const json = (await actor.toJsonLd()) as Record<string, unknown>;
    const attachments = attachmentMap(json);

    expect(json).toMatchObject({
      type: "Person",
      id: "https://erikcraddock.me/users/erik",
      preferredUsername: "erik",
      name: "Erik Craddock",
      inbox: "https://erikcraddock.me/users/erik/inbox",
      outbox: "https://erikcraddock.me/users/erik/outbox",
      followers: "https://erikcraddock.me/users/erik/followers",
      following: "https://erikcraddock.me/users/erik/following",
      url: "https://erikcraddock.me/",
    });
    expect(json.publicKey).toBeDefined();
    expect(json.assertionMethod).toBeDefined();
    expect(attachments.get("Website")).toMatchObject({ type: "PropertyValue" });
    expect(attachments.get("GitHub")?.value).toBe(
      '<a href="https://github.com/evcraddock" rel="me">github.com/evcraddock</a>'
    );
    expect(attachments.get("LinkedIn")?.type).toBe("PropertyValue");
    expect(attachments.get("YouTube")?.type).toBe("PropertyValue");
  });

  it("uses the same metadata for actor Update activities as the actor profile", async () => {
    const keys = [await createTestActorKeyPair()];
    const actor = buildActorProfile({ identifier: "erik", canonicalOrigin: origin, uris, keys });
    const update = buildActorUpdateActivity({
      identifier: "erik",
      canonicalOrigin: origin,
      uris,
      keys,
      activityId: new URL("/users/erik#update-test", origin),
    });

    const actorJson = (await actor.toJsonLd()) as Record<string, unknown>;
    const updateJson = (await update.toJsonLd()) as Record<string, unknown>;
    const updateObject = updateJson.object as Record<string, unknown>;

    expect(updateJson).toMatchObject({
      type: "Update",
      id: "https://erikcraddock.me/users/erik#update-test",
      actor: "https://erikcraddock.me/users/erik",
    });
    expect(attachmentMap(updateObject)).toEqual(attachmentMap(actorJson));
  });
});
