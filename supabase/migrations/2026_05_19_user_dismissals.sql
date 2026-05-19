-- User dismissals: lets a user permanently hide a challenge they didn't complete.
-- The record persists across sessions so a dismissed challenge never reappears.

create table if not exists public.user_dismissals (
  user_id      uuid not null references public.users(id)       on delete cascade,
  challenge_id uuid not null references public.challenges(id)  on delete cascade,
  dismissed_at timestamptz not null default now(),
  primary key (user_id, challenge_id)
);

-- Row-level security: each user can only see and modify their own dismissals
alter table public.user_dismissals enable row level security;

create policy "Users manage own dismissals"
  on public.user_dismissals
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Speed up the "fetch my dismissals" query issued on every challenges page load
create index if not exists user_dismissals_user_id_idx
  on public.user_dismissals (user_id);
