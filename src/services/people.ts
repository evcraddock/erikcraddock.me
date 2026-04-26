import { asc, eq } from "drizzle-orm";
import { db, people, personSocialAccounts } from "@/db";

export interface PersonSocialAccount {
  id: number;
  person_id: number;
  label: string;
  url: string;
  is_activitypub: boolean;
  sort_order: number;
}

export interface Person {
  id: number;
  name: string;
  url: string | null;
  social_accounts: PersonSocialAccount[];
}

export interface PersonSocialAccountInput {
  label: string;
  url: string;
  is_activitypub?: boolean;
}

export interface CreatePersonInput {
  name: string;
  url?: string | null;
  social_accounts?: PersonSocialAccountInput[];
}

export interface UpdatePersonInput {
  name?: string;
  url?: string | null;
  social_accounts?: PersonSocialAccountInput[];
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

function attachSocialAccounts(person: PersonRecord): Person {
  return { ...person, social_accounts: listSocialAccountsForPerson(person.id) };
}

function replaceSocialAccounts(personId: number, accounts: PersonSocialAccountInput[]): void {
  db.delete(personSocialAccounts).where(eq(personSocialAccounts.person_id, personId)).run();

  if (accounts.length === 0) {
    return;
  }

  db.insert(personSocialAccounts)
    .values(
      accounts.map((account, index) => ({
        person_id: personId,
        label: account.label,
        url: account.url,
        is_activitypub: account.is_activitypub ?? false,
        sort_order: index,
      }))
    )
    .run();
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

  return getPerson(id);
}
