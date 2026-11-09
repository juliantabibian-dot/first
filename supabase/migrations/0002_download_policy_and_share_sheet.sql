-- Two product decisions made after 0001:
--
-- 1. Each photo gets a download setting chosen when it is uploaded:
--    'alert'   = downloads allowed, watchers are texted
--    'blocked' = the photo can never be saved out of the app
--    It can never be changed afterwards (enforced by a trigger, so not even
--    a server function can flip it).
--
-- 2. Sharing happens through the iPhone share sheet, not to other Lookout
--    users. So there are no in-app recipients: photo_shares goes away and
--    you can only ever read your own photos and profile.

alter table public.photos
  add column download_policy text not null default 'alert'
    check (download_policy in ('alert', 'blocked')),
  add column width  int check (width > 0),
  add column height int check (height > 0);

-- New rows must state the choice explicitly.
alter table public.photos alter column download_policy drop default;

create function public.photos_lock_upload_choices() returns trigger
language plpgsql as $$
begin
  if new.download_policy is distinct from old.download_policy then
    raise exception 'A photo''s download setting cannot be changed after upload';
  end if;
  if new.owner_id is distinct from old.owner_id
     or new.storage_path is distinct from old.storage_path then
    raise exception 'A photo''s owner and file cannot be changed';
  end if;
  return new;
end;
$$;

create trigger photos_lock_upload_choices
  before update on public.photos
  for each row execute function public.photos_lock_upload_choices();

drop policy "read own or shared photos" on public.photos;
create policy "read own photos" on public.photos
  for select to authenticated using (
    deleted_at is null and owner_id = (select auth.uid())
  );

drop policy "read profiles of share partners" on public.profiles;

drop table public.photo_shares;
