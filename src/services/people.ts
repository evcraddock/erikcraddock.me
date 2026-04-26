import { asc, eq } from "drizzle-orm";
import { db, people, personSocialAccounts } from "@/db";

export interface PersonSocialAccount {
  id: number;
  person_id: number;
  label: string;
  url: string;
  avatar_url: string | null;
  is_activitypub: boolean;
  is_default: boolean;
  sort_order: number;
}

export interface Person {
  id: number;
  name: string;
  url: string | null;
  social_accounts: PersonSocialAccount[];
  default_social_account: PersonSocialAccount | null;
}

export interface PersonSocialAccountInput {
  label: string;
  url: string;
  avatar_url?: string | null;
  is_activitypub?: boolean;
  is_default?: boolean;
}

export interface CreatePersonInput {
  name: string;
  url?: string | null;
  social_accounts?: PersonSocialAccountInput[];
  default_social_account_id?: number | null;
}

export interface UpdatePersonInput {
  name?: string;
  url?: string | null;
  social_accounts?: PersonSocialAccountInput[];
  default_social_account_id?: number | null;
}

type PersonRecord = typeof people.$inferSelect;

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

function listSocialAccountsForPerson(personId: number): PersonSocialAccount[] {
  return db
    .select()
    .from(personSocialAccounts)
    .where(eq(personSocialAccounts.person_id, personId))
    .orderBy(asc(personSocialAccounts.sort_order), asc(personSocialAccounts.id))
    .all();
}

export function getDefaultSocialAccount(
  accounts: PersonSocialAccount[]
): PersonSocialAccount | null {
  return (
    accounts.find((account) => account.is_default) ??
    accounts.find((account) => account.is_activitypub) ??
    null
  );
}

function attachSocialAccounts(person: PersonRecord): Person {
  const socialAccounts = listSocialAccountsForPerson(person.id);
  return {
    ...person,
    social_accounts: socialAccounts,
    default_social_account: getDefaultSocialAccount(socialAccounts),
  };
}

function replaceSocialAccounts(personId: number, accounts: PersonSocialAccountInput[]): void {
  db.delete(personSocialAccounts).where(eq(personSocialAccounts.person_id, personId)).run();

  if (accounts.length === 0) {
    return;
  }

  const defaultIndex = accounts.findIndex((account) => account.is_default);

  db.insert(personSocialAccounts)
    .values(
      accounts.map((account, index) => ({
        person_id: personId,
        label: account.label,
        url: account.url,
        avatar_url: account.avatar_url ?? null,
        is_activitypub: account.is_activitypub ?? false,
        is_default: defaultIndex === index,
        sort_order: index,
      }))
    )
    .run();
}

export function setDefaultSocialAccount(personId: number, socialAccountId: number | null): boolean {
  const existing = getPerson(personId);
  if (!existing) {
    return false;
  }

  if (socialAccountId !== null) {
    const account = existing.social_accounts.find((candidate) => candidate.id === socialAccountId);
    if (!account) {
      return false;
    }
  }

  db.update(personSocialAccounts)
    .set({ is_default: false })
    .where(eq(personSocialAccounts.person_id, personId))
    .run();

  if (socialAccountId !== null) {
    db.update(personSocialAccounts)
      .set({ is_default: true })
      .where(eq(personSocialAccounts.id, socialAccountId))
      .run();
  }

  return true;
}

export function listPeople(): Person[] {
  return db
    .select()
    .from(people)
    .orderBy(asc(people.name), asc(people.id))
    .all()
    .map(attachSocialAccounts);
}

export function getPerson(id: number): Person | null {
  const person = db.select().from(people).where(eq(people.id, id)).get();
  return person ? attachSocialAccounts(person) : null;
}

export function findPersonByName(name: string): Person | null {
  const normalized = normalizeName(name);
  return listPeople().find((person) => normalizeName(person.name) === normalized) ?? null;
}

export function createPerson(input: CreatePersonInput): Person {
  const person = db
    .insert(people)
    .values({ name: input.name, url: input.url ?? null })
    .returning()
    .get();

  if (input.social_accounts) {
    replaceSocialAccounts(person.id, input.social_accounts);
  }

  if (input.default_social_account_id !== undefined) {
    setDefaultSocialAccount(person.id, input.default_social_account_id);
  }

  return getPerson(person.id)!;
}

export function updatePerson(id: number, input: UpdatePersonInput): Person | null {
  const existing = getPerson(id);
  if (!existing) {
    return null;
  }

  const updates: Partial<{ name: string; url: string | null }> = {};
  if (input.name !== undefined) {
    updates.name = input.name;
  }
  if (input.url !== undefined) {
    updates.url = input.url;
  }

  if (Object.keys(updates).length > 0) {
    db.update(people).set(updates).where(eq(people.id, id)).run();
  }

  if (input.social_accounts !== undefined) {
    replaceSocialAccounts(id, input.social_accounts);
  }

  if (input.default_social_account_id !== undefined) {
    const updated = setDefaultSocialAccount(id, input.default_social_account_id);
    if (!updated) {
      throw new Error(`Default social account not found: ${input.default_social_account_id}`);
    }
  }

  return getPerson(id);
}
