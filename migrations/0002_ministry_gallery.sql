-- Bethel Church D1 Migration: Add multi-photo gallery column to ministry_roster
-- Run via: npx wrangler d1 migrations apply bethel-church-db --remote
-- (Also applied automatically and idempotently in functions/api/_db.ts ensureSchema)

ALTER TABLE ministry_roster ADD COLUMN gallery_json TEXT NOT NULL DEFAULT '[]';
