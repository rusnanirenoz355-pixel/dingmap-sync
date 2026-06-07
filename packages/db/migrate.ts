import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { resolveDatabasePath } from "./database-url";

const schemaPath = resolve(dirname(fileURLToPath(import.meta.url)), "schema.sql");
const schemaSql = readFileSync(schemaPath, "utf8");
const databasePath = resolveDatabasePath();

const database = new DatabaseSync(databasePath);
database.exec(schemaSql);
database.close();

console.log(`SQLite migration completed: ${databasePath}`);
