import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { resolveDatabasePath } from "./database-url";

const schemaPath = resolve(dirname(fileURLToPath(import.meta.url)), "schema.sql");
const schemaSql = readFileSync(schemaPath, "utf8");
const databasePath = resolveDatabasePath();

export function ensureCleanMarkersDeletedAtColumn(database: DatabaseSync): void {
  const rows = database.prepare("PRAGMA table_info(clean_markers)").all() as Array<{
    name: string;
  }>;

  if (!rows.some((row) => row.name === "deleted_at")) {
    database.exec("ALTER TABLE clean_markers ADD COLUMN deleted_at TEXT");
  }
}

export function runMigration(): void {
  const database = new DatabaseSync(databasePath);
  try {
    database.exec(schemaSql);
    ensureCleanMarkersDeletedAtColumn(database);
  } finally {
    database.close();
  }

  console.log(`SQLite migration completed: ${databasePath}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runMigration();
}
