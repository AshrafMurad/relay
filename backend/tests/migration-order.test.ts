import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const migrationsDir = path.resolve("prisma", "migrations");

interface MigrationFile {
  name: string;
  sql: string;
}

function loadMigrations(): MigrationFile[] {
  return readdirSync(migrationsDir)
    .filter((entry) => !entry.startsWith("_"))
    .sort()
    .map((name) => ({ name, sql: readFileSync(path.join(migrationsDir, name, "migration.sql"), "utf8") }));
}

function createdTables(sql: string): Set<string> {
  return new Set([...sql.matchAll(/CREATE TABLE "([A-Za-z]+)"/g)].map((match) => match[1]!));
}

function referencedTables(sql: string): Set<string> {
  const references = new Set<string>();
  for (const match of sql.matchAll(/REFERENCES "([A-Za-z]+)"/g)) references.add(match[1]!);
  for (const match of sql.matchAll(/CREATE (?:UNIQUE )?INDEX[^;]*?ON "([A-Za-z]+)"/g)) references.add(match[1]!);
  for (const match of sql.matchAll(/ALTER TABLE "([A-Za-z]+)"/g)) references.add(match[1]!);
  return references;
}

describe("prisma migration ordering", () => {
  it("sorts migration folders in ascending timestamp order", () => {
    const names = readdirSync(migrationsDir).filter((entry) => !entry.startsWith("_"));
    const sorted = [...names].sort();
    expect(sorted).toEqual(names);
    for (const name of names) {
      expect(name).toMatch(/^20\d{12}_[a-z0-9_]+$/);
    }
  });

  it("never references a table before the migration that creates it", () => {
    const migrations = loadMigrations();
    const createdAt = new Map<string, number>();
    migrations.forEach((migration, index) => {
      for (const table of createdTables(migration.sql)) {
        expect(createdAt.has(table), `${table} is created twice (${migration.name})`).toBe(false);
        createdAt.set(table, index);
      }
    });

    migrations.forEach((migration, index) => {
      for (const table of referencedTables(migration.sql)) {
        const creationIndex = createdAt.get(table);
        expect(
          creationIndex,
          `${migration.name} references "${table}", which no migration creates`,
        ).toBeDefined();
        expect(
          creationIndex! <= index,
          `${migration.name} references "${table}" before ${migrations[creationIndex!]!.name} creates it`,
        ).toBe(true);
      }
    });
  });
});
