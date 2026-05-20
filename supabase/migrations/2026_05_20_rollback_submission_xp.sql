-- [SECURITY] Atomic XP rollback + delete for owner-initiated submission deletion.
--
-- The previous JS implementation did a read-modify-write (select xp → compute
-- newXp → update xp), which is NOT atomic. Two concurrent DELETE requests on
-- different approved submissions could both read the same xp and only deduct
-- one submission's worth — letting the user keep XP they should have lost.
--
-- This function performs the entire rollback inside a single transaction with
-- an explicit row lock on the submission row, so concurrent deletes serialize
-- correctly.
--
-- Locked down: only the service_role (server) can EXECUTE it. The function
-- itself enforces ownership against the caller_id passed by the API.

CREATE OR REPLACE FUNCTION public.rollback_and_delete_submission(
  _submission_id uuid,
  _caller_id     uuid
)
RETURNS TABLE (photo_url text, photo_url_2 text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id     uuid;
  v_status      text;
  v_xp_awarded  integer;
  v_photo_url   text;
  v_photo_url_2 text;
BEGIN
  -- Lock the row to serialize concurrent deletes of approved submissions
  SELECT user_id, status, xp_awarded, photo_url, photo_url_2
    INTO v_user_id, v_status, v_xp_awarded, v_photo_url, v_photo_url_2
    FROM public.submissions
   WHERE id = _submission_id
   FOR UPDATE;

  IF NOT FOUND THEN
    -- Same error message regardless of cause to avoid info disclosure
    RAISE EXCEPTION 'not_found_or_forbidden' USING ERRCODE = 'P0002';
  END IF;

  -- [SECURITY] Defense-in-depth ownership check (server also checks before calling)
  IF v_user_id <> _caller_id THEN
    RAISE EXCEPTION 'not_found_or_forbidden' USING ERRCODE = 'P0002';
  END IF;

  -- Only deduct XP if the submission was approved AND has XP to return.
  -- Contested submissions already had their XP deducted by the status-change
  -- trigger, so a delete must NOT double-deduct (status='contested' here).
  IF v_status = 'approved' AND v_xp_awarded > 0 THEN
    UPDATE public.users
       SET xp = GREATEST(0::bigint, xp - v_xp_awarded)
     WHERE id = v_user_id;

    PERFORM public.recalculate_level(v_user_id);
  END IF;

  DELETE FROM public.submissions WHERE id = _submission_id;

  photo_url   := v_photo_url;
  photo_url_2 := v_photo_url_2;
  RETURN NEXT;
END;
$$;

-- [SECURITY] Lock down execution — only the API (service_role) may call this.
REVOKE ALL ON FUNCTION public.rollback_and_delete_submission(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rollback_and_delete_submission(uuid, uuid) FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION public.rollback_and_delete_submission(uuid, uuid) TO service_role;
