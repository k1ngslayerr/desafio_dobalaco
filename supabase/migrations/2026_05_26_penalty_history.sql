-- Penalty history: persists every individual punishment assigned to a user.
-- The current_penalty on users is ephemeral (cleared when fulfilled);
-- this table is the permanent audit log so profiles can show past punishments.

create table if not exists public.penalty_history (
  id           uuid        not null default gen_random_uuid() primary key,
  user_id      uuid        not null references public.users(id)  on delete cascade,
  penalty_text text        not null,
  assigned_at  timestamptz not null default now(),
  assigned_by  uuid                 references public.users(id)  on delete set null,
  cleared_at   timestamptz          -- null = not yet cleared/fulfilled
);

-- RLS: all authenticated users can read (group-accountability app — everyone
-- sees everyone's punishment history). Only service_role may write.
alter table public.penalty_history enable row level security;

create policy "Authenticated read penalty_history"
  on public.penalty_history for select
  using (auth.role() = 'authenticated');

-- Speed up per-user lookups on profile pages
create index if not exists penalty_history_user_id_idx
  on public.penalty_history (user_id, assigned_at desc);
