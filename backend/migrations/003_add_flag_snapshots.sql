-- Lets a review_flags row survive its review being permanently deleted
-- (professor takedown -> "Delete permanently"). review_id becomes nullable,
-- and three snapshot columns capture what the flag was about at the moment
-- the review is deleted, so the moderation audit trail doesn't disappear
-- along with the review itself. Safe to run more than once.

ALTER TABLE review_flags
    ALTER COLUMN review_id DROP NOT NULL;

ALTER TABLE review_flags
    ADD COLUMN IF NOT EXISTS review_text_snapshot VARCHAR,
    ADD COLUMN IF NOT EXISTS professor_name_snapshot VARCHAR,
    ADD COLUMN IF NOT EXISTS course_code_snapshot VARCHAR;
