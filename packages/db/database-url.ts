import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, isAbsolute, resolve } from "node:path";

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function readEnvFileValue(filePath: string, key: string): string | undefined {
  if (!existsSync(filePath)) {
    return undefined;
  }

  const line = readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .find((entry) => entry.trim().startsWith(`${key}=`));

  if (!line) {
    return undefined;
  }

  return line.slice(line.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "");
}

export function resolveDatabasePath(): string {
  const databaseUrl =
    process.env.DATABASE_URL ??
    readEnvFileValue(resolve(PROJECT_ROOT, ".env"), "DATABASE_URL") ??
    readEnvFileValue(resolve(PROJECT_ROOT, ".env.example"), "DATABASE_URL") ??
    "file:./data/app.db";

  const rawPath = databaseUrl.startsWith("file:") ? databaseUrl.slice("file:".length) : databaseUrl;
  const databasePath = isAbsolute(rawPath) ? rawPath : resolve(PROJECT_ROOT, rawPath);

  mkdirSync(dirname(databasePath), { recursive: true });
  return databasePath;
}
