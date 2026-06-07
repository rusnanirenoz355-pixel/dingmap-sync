import { DatabaseSync } from "node:sqlite";
import { resolveDatabasePath } from "./database-url";

const sources = [
  {
    sourceKey: "youzhao",
    sourceName: "优招",
    sourceType: "web",
    startUrl: process.env.QINGZ_URL ?? "https://hr.qingz.xyz/positions/list",
    loginRequired: 1,
    strategy: "browser_plugin",
  },
  {
    sourceKey: "jiepin",
    sourceName: "捷聘",
    sourceType: "web",
    startUrl: process.env.CONOBUG_URL ?? "https://map.conobug.com",
    loginRequired: 1,
    strategy: "browser_plugin",
  },
  {
    sourceKey: "dingmap",
    sourceName: "钉图",
    sourceType: "dingmap",
    startUrl:
      process.env.DINGMAP_URL ??
      "https://dm.dingmap.com/home/map?id=c7b3a5c524864c698416c093843c34c6",
    loginRequired: 1,
    strategy: "one_click_export",
  },
  {
    sourceKey: "manual_paste",
    sourceName: "手动粘贴",
    sourceType: "manual_paste",
    startUrl: "manual://paste",
    loginRequired: 0,
    strategy: "manual",
  },
  {
    sourceKey: "excel_import",
    sourceName: "Excel 导入",
    sourceType: "excel",
    startUrl: "file://uploads",
    loginRequired: 0,
    strategy: "file",
  },
];

const database = new DatabaseSync(resolveDatabasePath());
const statement = database.prepare(`
  INSERT INTO sources (
    source_key,
    source_name,
    source_type,
    start_url,
    login_required,
    strategy,
    config_json,
    enabled,
    updated_at
  )
  VALUES (?, ?, ?, ?, ?, ?, '{}', 1, datetime('now'))
  ON CONFLICT(source_key) DO UPDATE SET
    source_name = excluded.source_name,
    source_type = excluded.source_type,
    start_url = excluded.start_url,
    login_required = excluded.login_required,
    strategy = excluded.strategy,
    updated_at = datetime('now')
`);

for (const source of sources) {
  statement.run(
    source.sourceKey,
    source.sourceName,
    source.sourceType,
    source.startUrl,
    source.loginRequired,
    source.strategy,
  );
}

database.close();

console.log(`Seeded ${sources.length} source definitions.`);
