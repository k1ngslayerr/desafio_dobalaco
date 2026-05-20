-- Add "failed" to the submissions status enum / check constraint.
-- This allows users to self-report non-completion for a challenge,
-- creating a record visible to admins and the feed (no XP awarded).
--
-- The unique constraint on (challenge_id, user_id, submitted_date)
-- still applies — a failed submission blocks another submission for
-- the same challenge that day (user must delete it first to resubmit).

-- Drop the old check constraint and recreate it with "failed" included.
-- Constraint name may vary by Supabase project; use DO block to be safe.
DO $$
BEGIN
  -- Try to find and drop the existing status check on submissions
  ALTER TABLE public.submissions
    DROP CONSTRAINT IF EXISTS submissions_status_check;

  ALTER TABLE public.submissions
    ADD CONSTRAINT submissions_status_check
    CHECK (status IN ('pending', 'approved', 'contested', 'rejected', 'failed'));
END $$;
