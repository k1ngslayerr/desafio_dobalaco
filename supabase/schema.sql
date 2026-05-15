-- ============================================================
-- DesafioHub – Complete Supabase Schema (post-hardening)
--
-- This file mirrors the production database, with all migrations
-- in supabase/migrations/ already folded in. Use it for fresh
-- installs only — for incremental changes on an existing DB,
-- write a migration in supabase/migrations/<date>_<name>.sql
-- instead.
--
-- Run order: just paste this whole file in the Supabase SQL Editor.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TABLES
-- ============================================================

-- users: mirrors auth.users with extra game fields
CREATE TABLE public.users (
  id              uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username        text UNIQUE NOT NULL,
  full_name       text,
  avatar_url      text,
  xp              bigint NOT NULL DEFAULT 0 CHECK (xp >= 0),
  level           integer NOT NULL DEFAULT 1,
  role            text NOT NULL DEFAULT 'user'    CHECK (role   IN ('user', 'admin')),
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended')),
  current_penalty text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.challenges (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title           text NOT NULL,
  description     text NOT NULL,
  xp_reward       integer NOT NULL CHECK (xp_reward > 0),
  penalty_xp      integer NOT NULL DEFAULT 0 CHECK (penalty_xp >= 0),
  requires_photo  boolean NOT NULL DEFAULT true,
  frequency       text    NOT NULL DEFAULT 'daily' CHECK (frequency IN ('daily', 'weekly', 'streak')),
  weekly_target   integer NOT NULL DEFAULT 1 CHECK (weekly_target BETWEEN 1 AND 7),
  starts_at       date,
  ends_at         date,
  quantity_label  text,
  xp_per_unit     integer CHECK (xp_per_unit IS NULL OR xp_per_unit > 0),
  max_quantity    integer CHECK (max_quantity IS NULL OR max_quantity > 0),
  created_by      uuid REFERENCES public.users(id) ON DELETE SET NULL,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.submissions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id    uuid NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  photo_url       text,                                       -- nullable: photo-optional challenges
  title           text,
  description     text,
  status          text NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'approved', 'contested', 'rejected')),
  xp_awarded      integer NOT NULL DEFAULT 0,
  quantity        integer CHECK (quantity IS NULL OR quantity > 0),
  submitted_date  date NOT NULL DEFAULT CURRENT_DATE,
  contested_by    uuid REFERENCES public.users(id),
  contested_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, user_id, submitted_date)
);

CREATE TABLE public.reactions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id   uuid NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type            text NOT NULL CHECK (type IN ('positive', 'negative')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (submission_id, user_id)
);

CREATE TABLE public.level_config (
  level           integer PRIMARY KEY,
  -- bigint: 1.15^(N-1) × 100 grows past INT_MAX around level 122
  xp_required     bigint NOT NULL,
  art_tier        integer NOT NULL
);

CREATE TABLE public.user_excuses (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  excuse_date  date NOT NULL,
  reason       text,
  created_by   uuid REFERENCES public.users(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, excuse_date)
);

-- Single-row table for app-wide settings (id always TRUE)
CREATE TABLE public.app_settings (
  id                    boolean PRIMARY KEY DEFAULT TRUE CHECK (id = TRUE),
  group_penalty_text    text NOT NULL DEFAULT '',
  group_penalty_active  boolean NOT NULL DEFAULT false,
  updated_at            timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.app_settings (id) VALUES (TRUE)
  ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- POPULATE level_config (100 levels, quadratic progression)
-- xp_required(n) = 100*(n-1) + 10*(n-1)²
-- Gap grows from 110 XP (level 1→2) to 2070 XP (level 99→100).
-- At ~1,000 XP/week: level 10 ≈ 1.7 weeks, level 100 ≈ 2 years.
-- art_tier = CEIL(level / 10)
-- ============================================================
INSERT INTO public.level_config (level, xp_required, art_tier)
SELECT
  n                                                       AS level,
  (100 * (n - 1) + 10 * (n - 1) * (n - 1))::bigint      AS xp_required,
  CEIL(n / 10.0)::integer                                  AS art_tier
FROM generate_series(1, 100) AS n;

-- ============================================================
-- FUNCTION: recalculate user level after XP changes
-- ============================================================
CREATE OR REPLACE FUNCTION public.recalculate_level(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_xp    bigint;
  v_level integer;
BEGIN
  SELECT xp INTO v_xp FROM public.users WHERE id = p_user_id;

  SELECT COALESCE(MAX(level), 1)
    INTO v_level
    FROM public.level_config
   WHERE xp_required <= v_xp;

  UPDATE public.users SET level = v_level WHERE id = p_user_id;
END;
$$;

-- ============================================================
-- TRIGGER: award XP when a submission is approved
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_submission_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reward   integer;
  v_penalty  integer;
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
    SELECT xp_reward INTO v_reward
      FROM public.challenges WHERE id = NEW.challenge_id;

    -- Respect a pre-calculated xp_awarded (set by /api/submissions when
    -- the challenge uses xp_per_unit + quantity).
    IF NEW.xp_awarded IS NULL OR NEW.xp_awarded = 0 THEN
      NEW.xp_awarded := v_reward;
    END IF;

    UPDATE public.users
       SET xp = xp + NEW.xp_awarded
     WHERE id = NEW.user_id;

    PERFORM public.recalculate_level(NEW.user_id);
  END IF;

  IF NEW.status = 'contested' AND OLD.status IN ('pending', 'approved') THEN
    SELECT penalty_xp INTO v_penalty
      FROM public.challenges WHERE id = NEW.challenge_id;

    UPDATE public.users
       SET xp = GREATEST(0::bigint, xp - OLD.xp_awarded - v_penalty)
     WHERE id = NEW.user_id;

    NEW.xp_awarded := 0;
    NEW.contested_at := now();

    PERFORM public.recalculate_level(NEW.user_id);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_submission_status_change
  BEFORE UPDATE OF status ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.handle_submission_status_change();

-- ============================================================
-- TRIGGER: auto-create users row on Supabase Auth sign-up
-- [SECURITY] Username defaults to an unguessable placeholder if the
-- signup didn't carry one (e.g. OAuth without custom username). The
-- old behaviour — split_part(email, '@', 1) — leaked the email prefix
-- to any authenticated user via the users SELECT policy.
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

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- TRIGGER: protect privileged user columns from self-update
-- [SECURITY] The "users: self can update" RLS policy only checks
-- row ownership, not column-level access. Without this trigger any
-- authed user could call
--   UPDATE users SET role='admin', xp=9e18 WHERE id=auth.uid()
-- straight from the browser anon client.
-- ============================================================
CREATE OR REPLACE FUNCTION public.protect_user_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Service role (auth.uid() IS NULL) and admins are allowed through.
  IF auth.uid() IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- Silently revert privileged columns for everyone else.
  NEW.role            := OLD.role;
  NEW.xp              := OLD.xp;
  NEW.level           := OLD.level;
  NEW.status          := OLD.status;
  NEW.current_penalty := OLD.current_penalty;
  RETURN NEW;
END;
$$;

CREATE TRIGGER prevent_user_privilege_escalation
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.protect_user_privileged_columns();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.users        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenges   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reactions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.level_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_excuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Helper: is the current JWT an admin?
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
     WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- ── users ────────────────────────────────────────────────────
-- [SECURITY] SELECT restricted to authenticated callers so the public
-- anon key can no longer enumerate usernames / full names.
CREATE POLICY "users: authenticated can read"
  ON public.users FOR SELECT
  TO authenticated
  USING (true);

-- Row ownership only; column protection enforced by the
-- prevent_user_privilege_escalation trigger above.
CREATE POLICY "users: self or admin can update row"
  ON public.users FOR UPDATE
  USING (id = auth.uid() OR public.is_admin())
  WITH CHECK (id = auth.uid() OR public.is_admin());

-- ── challenges ───────────────────────────────────────────────
CREATE POLICY "challenges: anyone can read active"
  ON public.challenges FOR SELECT USING (is_active = true OR public.is_admin());

CREATE POLICY "challenges: admin can insert"
  ON public.challenges FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "challenges: admin can update"
  ON public.challenges FOR UPDATE USING (public.is_admin());

CREATE POLICY "challenges: admin can delete"
  ON public.challenges FOR DELETE USING (public.is_admin());

-- ── submissions ──────────────────────────────────────────────
CREATE POLICY "submissions: anyone can read"
  ON public.submissions FOR SELECT USING (true);

CREATE POLICY "submissions: user can insert own"
  ON public.submissions FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "submissions: admin can update"
  ON public.submissions FOR UPDATE USING (public.is_admin());

-- ── reactions ────────────────────────────────────────────────
CREATE POLICY "reactions: anyone can read"
  ON public.reactions FOR SELECT USING (true);

-- [SECURITY] Block reacting to one's own submission at the RLS layer.
-- Defense in depth — /api/reactions enforces this too.
CREATE POLICY "reactions: user can insert own (not on own submission)"
  ON public.reactions FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND submission_id NOT IN (
      SELECT id FROM public.submissions WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "reactions: user can update own"
  ON public.reactions FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "reactions: user can delete own"
  ON public.reactions FOR DELETE USING (user_id = auth.uid());

-- ── level_config ─────────────────────────────────────────────
CREATE POLICY "level_config: anyone can read"
  ON public.level_config FOR SELECT USING (true);

-- ── user_excuses ─────────────────────────────────────────────
CREATE POLICY "user_excuses: authenticated can read"
  ON public.user_excuses FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "user_excuses: admin can insert"
  ON public.user_excuses FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "user_excuses: admin can delete"
  ON public.user_excuses FOR DELETE USING (public.is_admin());

-- ── app_settings ─────────────────────────────────────────────
CREATE POLICY "app_settings: authenticated can read"
  ON public.app_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "app_settings: admin can update"
  ON public.app_settings FOR UPDATE USING (public.is_admin());

-- ============================================================
-- INDEXES for performance
-- ============================================================
CREATE INDEX idx_submissions_challenge      ON public.submissions(challenge_id);
CREATE INDEX idx_submissions_user           ON public.submissions(user_id);
CREATE INDEX idx_submissions_status         ON public.submissions(status);
CREATE INDEX idx_submissions_submitted_date ON public.submissions(submitted_date);
CREATE INDEX idx_reactions_submission       ON public.reactions(submission_id);
CREATE INDEX idx_users_xp                   ON public.users(xp DESC);
CREATE INDEX idx_users_status               ON public.users(status);
CREATE INDEX idx_level_config_xp            ON public.level_config(xp_required);
CREATE INDEX idx_excuses_user               ON public.user_excuses(user_id);
CREATE INDEX idx_excuses_date               ON public.user_excuses(excuse_date);

-- ============================================================
-- REALTIME: enable on tables the app subscribes to
-- (the ranking/pending pages poll via API instead — see RLS notes).
-- ============================================================
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.submissions;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.reactions;
