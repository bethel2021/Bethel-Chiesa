-- Bethel Church D1 SQLite Initial Schema
-- Run via: npx wrangler d1 migrations apply bethel-church-db --remote

CREATE TABLE IF NOT EXISTS church_info (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS coworkers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  image TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_coworkers_sort ON coworkers(sort_order);

CREATE TABLE IF NOT EXISTS worship_times (
  id TEXT PRIMARY KEY,
  time TEXT NOT NULL,
  title TEXT NOT NULL,
  place TEXT NOT NULL,
  desc TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_worship_times_sort ON worship_times(sort_order);

CREATE TABLE IF NOT EXISTS liturgy_steps (
  id TEXT PRIMARY KEY,
  liturgy_type TEXT NOT NULL,
  time TEXT NOT NULL,
  step TEXT NOT NULL,
  scripture_or_hymn TEXT NOT NULL DEFAULT '',
  leader TEXT NOT NULL,
  note TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_liturgy_steps_sort ON liturgy_steps(sort_order);

CREATE TABLE IF NOT EXISTS ministry_roster (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  image TEXT NOT NULL,
  schedule TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ministry_roster_sort ON ministry_roster(sort_order);

CREATE TABLE IF NOT EXISTS weekday_ministries (
  id TEXT PRIMARY KEY,
  day TEXT NOT NULL,
  time TEXT NOT NULL,
  title TEXT NOT NULL,
  location TEXT NOT NULL DEFAULT '',
  leader TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_weekday_ministries_sort ON weekday_ministries(sort_order);

CREATE TABLE IF NOT EXISTS announcements (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  date TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  time TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  contact TEXT NOT NULL DEFAULT '',
  image TEXT NOT NULL DEFAULT '',
  is_featured INTEGER NOT NULL DEFAULT 0,
  details_json TEXT NOT NULL DEFAULT '[]',
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_announcements_sort ON announcements(sort_order);

CREATE TABLE IF NOT EXISTS public_snapshot (
  id TEXT PRIMARY KEY,
  bundle_json TEXT NOT NULL,
  version INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS visitor_requests (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  contact TEXT NOT NULL,
  intent TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  admin_note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_visitor_requests_created ON visitor_requests(created_at DESC);

CREATE TABLE IF NOT EXISTS admins (
  uid TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  can_view_visitor_stats INTEGER NOT NULL DEFAULT 0,
  added_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS visitor_ips (
  ip_hash TEXT PRIMARY KEY,
  country TEXT NOT NULL DEFAULT '',
  region TEXT NOT NULL DEFAULT '',
  counted_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_visitor_ips_counted ON visitor_ips(counted_at DESC);

CREATE TABLE IF NOT EXISTS site_stats (
  id TEXT PRIMARY KEY,
  total_visitors INTEGER NOT NULL DEFAULT 0,
  last_visitor_id TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS media_files (
  key TEXT PRIMARY KEY,
  content_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  chunk_count INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS media_chunks (
  media_key TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  data_b64 TEXT NOT NULL,
  PRIMARY KEY (media_key, chunk_index)
);
