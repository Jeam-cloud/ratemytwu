-- Adds the columns the moderation/report system needs.
-- Safe to run more than once (IF NOT EXISTS guards).
-- Run this against your actual Postgres DB (psql, Supabase SQL editor, etc.)

ALTER TABLE reviews
    ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS hidden_reason VARCHAR;

ALTER TABLE review_flags
    ADD COLUMN IF NOT EXISTS status VARCHAR NOT NULL DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS resolution VARCHAR,
    ADD COLUMN IF NOT EXISTS resolution_note VARCHAR,
    ADD COLUMN IF NOT EXISTS resolved_by UUID,
    ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
