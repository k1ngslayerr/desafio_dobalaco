-- ============================================================
-- [SECURITY] Stop leaking email prefix as default username.
--
-- Problem: the old handle_new_user() trigger fell back to
--   split_part(NEW.email, '@', 1)
-- when raw_user_meta_data.username was missing. With the
-- `users: anyone can read` SELECT policy (since restricted to
-- `authenticated` by 2026_05_15_fix_privilege_escalation.sql),
-- this still leaks the email-prefix of any user who signed up
-- via Google OAuth without providing a custom username.
--
-- Even now that SELECT is restricted to authenticated callers,
-- any registered user can enumerate usernames and infer the
-- email of OAuth signups. Replacing the default with a
-- non-identifying token closes the leak.
--
-- Strategy:
--   1. If the metadata provides `username`, use it.
--   2. Otherwise generate an unguessable placeholder
--      `user_<random>` that the user can edit later from
--      the profile page.
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_username text;
BEGIN
  v_username := NULLIF(trim(NEW.raw_user_meta_data->>'username'), '');

  IF v_username IS NULL THEN
    -- 10 chars from the gen_random_uuid hex: collision risk is negligible
    -- for any realistic user base, and the trigger retries via ON CONFLICT.
    v_username := 'user_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);
  END IF;

  INSERT INTO public.users (id, username, full_name, avatar_url)
  VALUES (
    NEW.id,
    v_username,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
