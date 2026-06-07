PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_key TEXT NOT NULL UNIQUE,
  source_name TEXT NOT NULL,
  source_type TEXT NOT NULL,
  start_url TEXT,
  login_required INTEGER NOT NULL DEFAULT 0,
  strategy TEXT NOT NULL DEFAULT 'manual',
  config_json TEXT NOT NULL DEFAULT '{}',
  enabled INTEGER NOT NULL DEFAULT 1,
  last_collected_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS raw_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  source_id TEXT,
  raw_title TEXT,
  raw_address TEXT,
  raw_phone TEXT,
  raw_salary TEXT,
  raw_welfare TEXT,
  raw_manager TEXT,
  raw_json TEXT NOT NULL DEFAULT '{}',
  fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
  parse_status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS clean_markers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  source_id TEXT,
  site_name TEXT NOT NULL,
  address TEXT NOT NULL,
  longitude REAL,
  latitude REAL,
  station_manager TEXT,
  phone TEXT,
  salary TEXT,
  welfare TEXT,
  interview_time TEXT,
  job_title TEXT,
  remark TEXT,
  origin_type TEXT NOT NULL,
  dingmap_marker_id TEXT,
  sync_action TEXT NOT NULL DEFAULT 'review',
  sync_status TEXT NOT NULL DEFAULT 'need_confirm',
  current_hash TEXT,
  last_synced_hash TEXT,
  locked_fields TEXT,
  merge_key TEXT,
  manual_override INTEGER NOT NULL DEFAULT 0,
  error_msg TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sync_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT,
  summary_json TEXT,
  error_msg TEXT
);

CREATE TABLE IF NOT EXISTS sync_plan (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL,
  clean_marker_id INTEGER NOT NULL,
  source TEXT NOT NULL,
  source_id TEXT,
  action TEXT NOT NULL,
  reason TEXT NOT NULL,
  before_hash TEXT,
  after_hash TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  error_msg TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT,
  FOREIGN KEY (clean_marker_id) REFERENCES clean_markers(id)
);

CREATE TABLE IF NOT EXISTS sync_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL,
  source TEXT NOT NULL,
  source_id TEXT,
  action TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT,
  status TEXT NOT NULL,
  error_msg TEXT,
  screenshot_path TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_raw_records_source ON raw_records(source, source_id);
CREATE INDEX IF NOT EXISTS idx_clean_markers_source ON clean_markers(source, source_id);
CREATE INDEX IF NOT EXISTS idx_clean_markers_merge_key ON clean_markers(merge_key);
CREATE INDEX IF NOT EXISTS idx_sync_plan_run_id ON sync_plan(run_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_run_id ON sync_logs(run_id);
