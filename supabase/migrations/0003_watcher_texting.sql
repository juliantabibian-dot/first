-- Milestone 3: adding watchers and texting them. Run after 0002.
--
-- Nothing here loosens access: the app still only READS watchers, events and
-- texts. Every change goes through an Edge Function using the service role.

-- 1. A ledger of code and test texts, used only to rate-limit them.
--    It is keyed by owner + phone number rather than by watcher so that
--    removing a watcher and adding the same number again does not reset the
--    limits. Like watcher_codes it has no client policies at all.
create table public.send_attempts (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles (id) on delete cascade,
  phone_e164 text not null,
  kind       text not null check (kind in ('code', 'test')),
  created_at timestamptz not null default now()
);
create index send_attempts_owner_idx on public.send_attempts (owner_id, created_at desc);
alter table public.send_attempts enable row level security;

-- 2. Before Twilio is connected, texts are only simulated and the owner can
--    read the code in the app. A number confirmed that way never really
--    agreed to anything, so it is flagged and never sent a real text. The
--    owner removes it and adds it again once texting works.
alter table public.watchers
  add column verified_simulated boolean not null default false;

-- 3. The inbound STOP/START webhook looks watchers up by phone number.
create index watchers_phone_idx on public.watchers (phone_e164);

-- 4. Remembers whether a code was only simulated, so that confirming it sets
--    the flag above even if Twilio is connected in between.
alter table public.watcher_codes
  add column simulated boolean not null default false;
