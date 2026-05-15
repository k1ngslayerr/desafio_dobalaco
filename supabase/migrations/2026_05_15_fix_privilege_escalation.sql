-- ============================================================
-- [SECURITY-CRITICAL] Fix privilege escalation via RLS
--
-- Problem: the previous schema had two PERMISSIVE UPDATE policies
-- on public.users that were OR'd together. The first ("self can update")
-- granted any authenticated user UPDATE on their OWN row with NO
-- column restriction — so a regular user could call:
--   supabase.from("users").update({ role: "admin", xp: 9e18 }).eq("id", auth.uid())
-- directly from the browser (anon key + their own JWT) and escalate
-- to admin.
--
-- Fix:
--   1. Drop both old policies.
--   2. Keep a permissive policy that grants UPDATE on the user's own row.
--   3. Add a BEFORE UPDATE trigger that RESETS privileged columns
--      whenever the caller is an authenticated non-admin. This is
--      enforced regardless of which client makes the call (browser
--      anon, server with user JWT, etc.). The service-role admin
--      client has auth.uid() = NULL, so it bypasses the reset.
-- ============================================================

-- ── Drop vulnerable policies ─────────────────────────────────
DROP POLICY IF EXISTS "users: self can update"          ON public.users;
DROP POLICY IF EXISTS "users: only admin can change role" ON public.users;

-- ── New policy: row ownership only; column protection via trigger ──
CREATE POLICY "users: self or admin can update row"
  ON public.users FOR UPDATE
  USING (id = auth.uid() OR public.is_admin())
  WITH CHECK (id = auth.uid() OR public.is_admin());

-- ── Trigger: silently revert protected columns for non-admins ──
CREATE OR REPLACE FUNCTION public.protect_user_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Service role / system triggers have NULL auth.uid() — let them through.
  -- Admins are also allowed to change these columns.
  IF auth.uid() IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- For all other authenticated users: any attempt to change
  -- privileged columns is silently reverted to the previous value.
  -- (Silent revert is preferred over RAISE EXCEPTION so existing
  -- UPDATE flows for legitimate columns don't break.)
  NEW.role            := OLD.role;
  NEW.xp              := OLD.xp;
  NEW.level           := OLD.level;
  NEW.status          := OLD.status;
  NEW.current_penalty := OLD.current_penalty;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_user_privilege_escalation ON public.users;
CREATE TRIGGER prevent_user_privilege_escalation
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.protect_user_privileged_columns();

-- ============================================================
-- [SECURITY] Restrict the `users: anyone can read` policy.
-- Original policy lets unauthenticated clients (anon role) read
-- every user row. Restrict to authenticated callers only so the
-- anon key can no longer enumerate usernames / full_names.
-- ============================================================
DROP POLICY IF EXISTS "users: anyone can read" ON public.users;
CREATE POLICY "users: authenticated can read"
  ON public.users FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================
-- [SECURITY] Block self-reactions at the DB level (defense in depth).
-- The API layer already enforces this, but RLS should too —
-- otherwise direct calls via the anon client can bypass.
-- ============================================================
DROP POLICY IF EXISTS "reactions: user can insert own" ON public.reactions;
CREATE POLICY "reactions: user can insert own (not on own submission)"
  ON public.reactions FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND submission_id NOT IN (
      SELECT id FROM public.submissions WHERE user_id = auth.uid()
    )
  );
