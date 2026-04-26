import { asc, eq } from "drizzle-orm";
import { db, people } from "@/db";

export interface Person {
  id: number;
  name: string;
  url: string | null;
}

export interface CreatePersonInput {
  name: string;
  url?: string | null;
}

export interface UpdatePersonInput {
  name?: string;
  url?: string | null;
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

export function listPeople(): Person[] {
  return db.select().from(people).orderBy(asc(people.name), asc(people.id)).all();
}

export function getPerson(id: number): Person | null {
  return db.select().from(people).where(eq(people.id, id)).get() ?? null;
}

export function findPersonByName(name: string): Person | null {
  const normalized = normalizeName(name);
  return listPeople().find((person) => normalizeName(person.name) === normalized) ?? null;
}

export function createPerson(input: CreatePersonInput): Person {
  return db
    .insert(people)
    .values({ name: input.name, url: input.url ?? null })
    .returning()
    .get();
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

  return getPerson(id);
}
