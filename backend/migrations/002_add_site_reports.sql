-- Adds the professor opt-out flag and the new site_reports table
-- (wrong info / professor takedown / bug reports from the Report page).
-- Safe to run more than once.

ALTER TABLE professor
    ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS hidden_reason VARCHAR;

CREATE TABLE IF NOT EXISTS site_reports (
    id SERIAL PRIMARY KEY,
    category VARCHAR NOT NULL,
    contact_email VARCHAR NOT NULL,
    submitted_by_user_id UUID,
    professor_id INTEGER REFERENCES professor(id),
    course_code VARCHAR,
    description VARCHAR NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    status VARCHAR NOT NULL DEFAULT 'pending',
    resolution VARCHAR,
    resolution_note VARCHAR,
    resolved_by UUID,
    resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ix_site_reports_category ON site_reports (category);
CREATE INDEX IF NOT EXISTS ix_site_reports_professor_id ON site_reports (professor_id);
CREATE INDEX IF NOT EXISTS ix_site_reports_submitted_by_user_id ON site_reports (submitted_by_user_id);
