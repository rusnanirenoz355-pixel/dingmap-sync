import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it } from "vitest";

const databasePath = join(process.cwd(), "data", "test-migrate-deleted-at.db");
const schemaSql = readFileSync(join(process.cwd(), "packages", "db", "schema.sql"), "utf8");

function columnNames(database: DatabaseSync): string[] {
  return database
    .prepare("PRAGMA table_info(clean_markers)")
    .all()
    .map((row) => String((row as { name: string }).name));
}

describe("database deleted_at migration", () => {
  beforeEach(() => {
    process.env.DATABASE_URL = `file:${databasePath}`;
    if (existsSync(databasePath)) {
      rmSync(databasePath);
    }
    mkdirSync(dirname(databasePath), { recursive: true });
  });

  it("creates fresh clean_markers tables with deleted_at", () => {
    const database = new DatabaseSync(databasePath);
    try {
      database.exec(schemaSql);
      expect(columnNames(database)).toContain("deleted_at");
    } finally {
      database.close();
    }
  });

  it("adds deleted_at to old clean_markers tables idempotently", async () => {
    const { ensureCleanMarkersDeletedAtColumn } = await import("./migrate");
    const database = new DatabaseSync(databasePath);
    database.exec(`
      CREATE TABLE clean_markers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source TEXT NOT NULL,
        site_name TEXT NOT NULL,
        address TEXT NOT NULL
      );
    `);
    try {
      ensureCleanMarkersDeletedAtColumn(database);
      ensureCleanMarkersDeletedAtColumn(database);
      expect(columnNames(database).filter((name) => name === "deleted_at")).toHaveLength(1);
    } finally {
      database.close();
    }
  });
});
