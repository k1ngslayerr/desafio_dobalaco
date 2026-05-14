-- ============================================================
-- DesafioHub – Complete Supabase Schema
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- Enable UUID extension (already available in Supabase)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TABLES
-- ============================================================

-- users: mirrors auth.users with extra game fields
-- xp is bigint because high-level players accumulate large totals
CREATE TABLE public.users (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username    text UNIQUE NOT NULL,
  full_name   text,
  avatar_url  text,
  xp          bigint NOT NULL DEFAULT 0 CHECK (xp >= 0),
  level       integer NOT NULL DEFAULT 1,
  role        text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.challenges (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  description text NOT NULL,
  xp_reward   integer NOT NULL CHECK (xp_reward > 0),
  penalty_xp  integer NOT NULL DEFAULT 0 CHECK (penalty_xp >= 0),
  created_by  uuid REFERENCES public.users(id) ON DELETE SET NULL,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.submissions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  photo_url    text NOT NULL,
  status       text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'approved', 'contested', 'rejected')),
  xp_awarded   integer NOT NULL DEFAULT 0,
  contested_by uuid REFERENCES public.users(id),
  contested_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, user_id)
);

CREATE TABLE public.reactions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type          text NOT NULL CHECK (type IN ('positive', 'negative')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (submission_id, user_id)
);

CREATE TABLE public.level_config (
  level        integer PRIMARY KEY,
  -- bigint porque 1.15^(N-1) × 100 ultrapassa integer (~2.1 B) a partir do nível ~122
  xp_required  bigint NOT NULL,
  art_tier     integer NOT NULL
);

-- ============================================================
-- POPULATE level_config (1 000 levels, exponential progression)
-- XP(N) = ROUND(100 * 1.15^(N-1))
-- art_tier  = CEIL(level / 10)
--
-- Por que 3 mudanças foram necessárias:
--   1. POWER(float8, 999) cabe em float8 (~1.7e308), mas ao fazer
--      ::integer transborda já no nível ~122 (INT_MAX = 2 147 483 647).
--   2. Mudamos xp_required para BIGINT, mas 1.15^280 × 100 ≈ 9.9e18
--      excede também BIGINT_MAX = 9 223 372 036 854 775 807.
--   3. Solução final: POWER em NUMERIC (precisão arbitrária) +
--      LEAST com cap em NUMERIC antes do cast para BIGINT.
--      Níveis 1-280 têm XP exato; 281-1000 ficam capeados em
--      9 200 000 000 000 000 000 (9.2e18) — todos em "XP máximo" —
--      o que é intencional para níveis de prestígio.
-- ============================================================
INSERT INTO public.level_config (level, xp_required, art_tier)
SELECT
  n AS level,
  LEAST(
    ROUND(100.0 * POWER(1.15::numeric, n - 1)),
    9200000000000000000::numeric   -- cap abaixo do BIGINT_MAX (9.22e18)
  )::bigint AS xp_required,
  CEIL(n / 10.0)::integer AS art_tier
FROM generate_series(1, 1000) AS n;

-- ============================================================
-- FUNCTION: recalculate user level after XP changes
-- Runs as SECURITY DEFINER to bypass RLS on users table
-- [SECURITY] SECURITY DEFINER: only called from trusted triggers
-- ============================================================
CREATE OR REPLACE FUNCTION public.recalculate_level(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_xp    bigint;   -- bigint para corresponder à coluna users.xp
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
-- [SECURITY] Runs SECURITY DEFINER; only triggered by status change
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
  -- Only act when status actually changed
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  -- ── Approved: credit XP ──────────────────────────────────
  IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
    SELECT xp_reward INTO v_reward
      FROM public.challenges WHERE id = NEW.challenge_id;

    NEW.xp_awarded := v_reward;

    UPDATE public.users
       SET xp = xp + v_reward
     WHERE id = NEW.user_id;

    PERFORM public.recalculate_level(NEW.user_id);
  END IF;

  -- ── Contested: revoke XP, apply penalty ─────────────────
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

  -- ── Rejected (from pending, no XP yet): no-op ───────────
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_submission_status_change
  BEFORE UPDATE OF status ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.handle_submission_status_change();

-- ============================================================
-- TRIGGER: auto-create users row on Supabase Auth sign-up
-- [SECURITY] Reads raw_user_meta_data; username defaults to email prefix
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, username, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'username',
      split_part(NEW.email, '@', 1)
    ),
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
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.users        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenges   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reactions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.level_config ENABLE ROW LEVEL SECURITY;

-- Helper: is the current JWT an admin?
-- [SECURITY] Read role from users table, not JWT claim (claim set separately)
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
CREATE POLICY "users: anyone can read"
  ON public.users FOR SELECT USING (true);

CREATE POLICY "users: self can update"
  ON public.users FOR UPDATE
  USING (id = auth.uid() OR public.is_admin())
  WITH CHECK (id = auth.uid() OR public.is_admin());

-- Prevent role escalation by non-admins
-- [SECURITY] Users cannot change their own role field
CREATE POLICY "users: only admin can change role"
  ON public.users FOR UPDATE
  USING (
    (id = auth.uid() AND role = (SELECT role FROM public.users WHERE id = auth.uid()))
    OR public.is_admin()
  );

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

CREATE POLICY "reactions: user can insert own"
  ON public.reactions FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "reactions: user can update own"
  ON public.reactions FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "reactions: user can delete own"
  ON public.reactions FOR DELETE USING (user_id = auth.uid());

-- ── level_config ─────────────────────────────────────────────
CREATE POLICY "level_config: anyone can read"
  ON public.level_config FOR SELECT USING (true);

-- ============================================================
-- INDEXES for performance
-- ============================================================
CREATE INDEX idx_submissions_challenge   ON public.submissions(challenge_id);
CREATE INDEX idx_submissions_user        ON public.submissions(user_id);
CREATE INDEX idx_submissions_status      ON public.submissions(status);
CREATE INDEX idx_reactions_submission    ON public.reactions(submission_id);
CREATE INDEX idx_users_xp               ON public.users(xp DESC);
CREATE INDEX idx_level_config_xp        ON public.level_config(xp_required);

-- ============================================================
-- REALTIME: enable on needed tables
-- Run in Supabase Dashboard > Database > Replication OR:
-- ============================================================
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.submissions;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.reactions;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
