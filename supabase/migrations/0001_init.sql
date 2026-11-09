-- Lookout schema. Run once in the Supabase SQL editor (or `supabase db push`).
--
-- Rule of thumb for the policies below: the app can READ its own rows, but
-- anything that must send a text (adding/removing watchers, sharing, deleting
-- a photo, reporting an event) is written only by Edge Functions using the
-- service role, which bypasses RLS. That keeps a modified client from
-- changing things without the watchers being told.

create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  name       text not null check (char_length(btrim(name)) between 1 and 30),
  created_at timestamptz not null default now()
);

create table public.watchers (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles (id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 30),
  phone_e164  text not null check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  status      text not null default 'pending'
              check (status in ('pending', 'verified', 'opted_out')),
  verified_at timestamptz,
  created_at  timestamptz not null default now(),
  unique (owner_id, phone_e164)
);

-- Verification codes live in their own table with no client policies, so the
-- app can never read a code hash.
create table public.watcher_codes (
  watcher_id uuid primary key references public.watchers (id) on delete cascade,
  code_hash  text not null,
  expires_at timestamptz not null,
  attempts   int not null default 0,
  sent_at    timestamptz not null default now()
);

create table public.photos (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references public.profiles (id) on delete cascade,
  storage_path text not null,
  created_at   timestamptz not null default now(),
  deleted_at   timestamptz
);
create index photos_owner_idx on public.photos (owner_id, created_at desc);

create table public.photo_watchers (
  photo_id   uuid not null references public.photos (id) on delete cascade,
  watcher_id uuid not null references public.watchers (id) on delete cascade,
  added_at   timestamptz not null default now(),
  primary key (photo_id, watcher_id)
);
create index photo_watchers_watcher_idx on public.photo_watchers (watcher_id);

-- owner_id is copied from the photo so the policies on photos and
-- photo_shares don't have to query each other.
create table public.photo_shares (
  photo_id     uuid not null references public.photos (id) on delete cascade,
  owner_id     uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  shared_at    timestamptz not null default now(),
  primary key (photo_id, recipient_id)
);
create index photo_shares_recipient_idx on public.photo_shares (recipient_id);

create table public.events (
  id         uuid primary key default gen_random_uuid(),
  photo_id   uuid references public.photos (id) on delete set null,
  owner_id   uuid not null references public.profiles (id) on delete cascade,
  actor_id   uuid not null references public.profiles (id) on delete cascade,
  type       text not null check (type in (
               'share', 'download', 'screenshot', 'screen_record', 'delete',
               'watcher_added', 'watcher_removed', 'test')),
  meta       jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index events_owner_idx on public.events (owner_id, created_at desc);

-- watcher name/phone are copied in so the history survives a removed watcher.
create table public.texts (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references public.profiles (id) on delete cascade,
  watcher_id    uuid references public.watchers (id) on delete set null,
  watcher_name  text not null,
  watcher_phone text not null,
  event_id      uuid references public.events (id) on delete set null,
  body          text not null,
  twilio_sid    text,
  status        text not null default 'queued',
  created_at    timestamptz not null default now()
);
create index texts_owner_idx on public.texts (owner_id, created_at desc);

alter table public.profiles       enable row level security;
alter table public.watchers       enable row level security;
alter table public.watcher_codes  enable row level security;
alter table public.photos         enable row level security;
alter table public.photo_watchers enable row level security;
alter table public.photo_shares   enable row level security;
alter table public.events         enable row level security;
alter table public.texts          enable row level security;

-- profiles: you manage your own row. People you share with (either direction)
-- can read your name.
create policy "read own profile" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "read profiles of share partners" on public.profiles
  for select to authenticated using (
    exists (
      select 1 from public.photo_shares s
      where (s.owner_id = profiles.id and s.recipient_id = (select auth.uid()))
         or (s.recipient_id = profiles.id and s.owner_id = (select auth.uid()))
    )
  );
create policy "create own profile" on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));
create policy "update own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Everything else is read-only from the app.
create policy "read own watchers" on public.watchers
  for select to authenticated using (owner_id = (select auth.uid()));

create policy "read own or shared photos" on public.photos
  for select to authenticated using (
    deleted_at is null and (
      owner_id = (select auth.uid())
      or exists (
        select 1 from public.photo_shares s
        where s.photo_id = photos.id and s.recipient_id = (select auth.uid())
      )
    )
  );

-- Uploading sends no text, so the app adds photo rows itself.
create policy "add own photos" on public.photos
  for insert to authenticated with check (
    owner_id = (select auth.uid()) and deleted_at is null
  );

-- Only the owner sees who watches a photo; share recipients do not.
create policy "read watchers of own photos" on public.photo_watchers
  for select to authenticated using (
    exists (
      select 1 from public.watchers w
      where w.id = photo_watchers.watcher_id and w.owner_id = (select auth.uid())
    )
  );

create policy "read shares you are part of" on public.photo_shares
  for select to authenticated using (
    owner_id = (select auth.uid()) or recipient_id = (select auth.uid())
  );

create policy "read events on own photos" on public.events
  for select to authenticated using (owner_id = (select auth.uid()));

create policy "read own texts" on public.texts
  for select to authenticated using (owner_id = (select auth.uid()));

-- Private bucket for the photos themselves. Files are stored under
-- "<user id>/<file>", and are only ever served through short-lived signed URLs.
insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;

create policy "upload into own folder" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "read own files" on storage.objects
  for select to authenticated using (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
