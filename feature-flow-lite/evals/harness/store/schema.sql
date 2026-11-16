-- D1 schema for feature-flow-lite eval results. One row per build in `runs`;
-- raw files live in R2 under runs.r2_prefix.
CREATE TABLE IF NOT EXISTS suites (
  suite TEXT PRIMARY KEY,          -- e.g. 2026-11-16-0.4-vs-0.2
  started_at TEXT,
  notes TEXT
);
CREATE TABLE IF NOT EXISTS runs (
  suite TEXT NOT NULL REFERENCES suites(suite),
  scenario TEXT NOT NULL,
  arm TEXT NOT NULL,
  rep INTEGER NOT NULL,
  batch TEXT,                      -- results/<batch> it came from
  outcome_pass INTEGER,            -- 1 if every [outcome] check passed
  outcome_failed TEXT,             -- JSON list of failed outcome checks
  process_pass_rate REAL,
  audit_mergeable INTEGER,
  audit_must_fix INTEGER,
  cost_usd REAL,
  wall_s REAL,
  roles TEXT,                      -- JSON {role: count} from grading metrics.spawns
  rerun INTEGER DEFAULT 0,
  r2_prefix TEXT,                  -- evals/<suite>/<scenario>/<arm>/rep-N/
  PRIMARY KEY (suite, scenario, arm, rep)
);
CREATE TABLE IF NOT EXISTS judge_scores (
  suite TEXT NOT NULL,
  scenario TEXT NOT NULL,
  arm TEXT NOT NULL,
  rep INTEGER NOT NULL,
  judge INTEGER NOT NULL,          -- 1, 2, ...
  pass TEXT NOT NULL,              -- which judging pass, e.g. j1 or final
  score REAL,
  inspector_overall REAL,
  PRIMARY KEY (suite, scenario, arm, rep, judge, pass)
);
