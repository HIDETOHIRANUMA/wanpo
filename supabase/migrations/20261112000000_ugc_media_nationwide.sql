-- 口コミ・犬の写真投稿・店舗写真・予約リンク・全国展開
-- 方針
--  * 口コミと写真は「投稿後すぐ公開・通報で非表示」（private.app_settings の ugc_publish_mode で事前確認制にも切替可）
--  * 投稿者のIDは公開レスポンスに含めない（列単位の権限で除外）
--  * 書き込みは security definer 関数だけ。投稿回数の上限・重複防止をサーバー側で実施
--  * 口コミ・写真は施設の確認記録や判定条件を変えない

-- ---------- 施設：予約リンク・雰囲気タグ ----------
alter table public.places
  add column reservation_url text check (reservation_url ~ '^https://[A-Za-z0-9.-]+\.[A-Za-z]{2,}(:[0-9]{1,5})?(/[^[:space:]]*)?$' and char_length(reservation_url) <= 2000),
  add column atmosphere_tags text[] not null default '{}' check (cardinality(atmosphere_tags) <= 6);
create index places_latlng_idx on public.places (lat, lng) where publication_status = 'published';

-- ---------- 全国：エリア（市区町村）・駅 ----------
alter table public.areas
  add column prefecture_code smallint check (prefecture_code between 1 and 47),
  add column municipality_code text check (municipality_code ~ '^[0-9]{5,6}$');
create index areas_prefecture_idx on public.areas (prefecture_code) where is_active;
alter table public.stations
  add column operator text check (char_length(operator) <= 60),
  add column line_name text check (char_length(line_name) <= 60);
create index stations_name_idx on public.stations (name text_pattern_ops);

-- ---------- 店舗写真（運営が登録。権利・出典が必須） ----------
create type public.media_kind as enum ('exterior', 'interior', 'atmosphere', 'dog_area');
create table public.place_media (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places (id) on delete cascade,
  url text not null check (url ~ '^https://' and char_length(url) <= 2000),
  kind public.media_kind not null,
  caption text check (char_length(caption) <= 100),
  rights text not null check (char_length(rights) between 1 and 200), -- 例「店舗提供・掲載許諾あり」
  credit text not null check (char_length(credit) between 1 and 200),
  sort smallint not null default 0,
  created_at timestamptz not null default now()
);
create index place_media_place_idx on public.place_media (place_id, sort);
alter table public.place_media enable row level security;
grant select on public.place_media to anon, authenticated;
create policy media_read on public.place_media for select to anon, authenticated
  using (exists (select 1 from public.places p where p.id = place_id and p.publication_status = 'published'));

-- ---------- 口コミ ----------
create type public.ugc_status as enum ('pending', 'approved', 'rejected', 'hidden');
create type public.review_tag as enum ('cool_inside', 'staff_friendly', 'water_served', 'spacious', 'quiet', 'crowded', 'dog_menu', 'many_dogs');

create table public.place_reviews (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete cascade,
  nickname text not null check (char_length(btrim(nickname)) between 1 and 20),
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  tags public.review_tag[] not null default '{}' check (cardinality(tags) <= 8),
  visited_on date,
  status public.ugc_status not null default 'pending',
  created_at timestamptz not null default now(),
  published_at timestamptz,
  client_request_id uuid not null,
  constraint review_request_once unique (author_id, client_request_id)
);
create index place_reviews_place_idx on public.place_reviews (place_id, published_at desc) where status = 'approved';

-- ---------- 犬の写真（Storage の非公開バケット user-photos に実体） ----------
create table public.place_photos (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places (id) on delete cascade,
  uploader_id uuid not null references auth.users (id) on delete cascade,
  storage_path text not null unique,
  caption text check (char_length(caption) <= 100),
  uploaded boolean not null default false,
  status public.ugc_status not null default 'pending',
  created_at timestamptz not null default now(),
  published_at timestamptz,
  client_request_id uuid not null,
  constraint photo_request_once unique (uploader_id, client_request_id)
);
create index place_photos_place_idx on public.place_photos (place_id, published_at desc) where status = 'approved';

alter table public.place_reviews enable row level security;
alter table public.place_photos enable row level security;

-- 投稿者IDは公開しない：列を限定して付与
grant select (id, place_id, nickname, body, tags, visited_on, published_at) on public.place_reviews to anon;
grant select (id, place_id, nickname, body, tags, visited_on, published_at, status, created_at) on public.place_reviews to authenticated;
grant select (id, place_id, storage_path, caption, published_at) on public.place_photos to anon;
grant select (id, place_id, storage_path, caption, published_at, status, created_at, uploaded) on public.place_photos to authenticated;

create policy reviews_read_public on public.place_reviews for select to anon, authenticated
  using (status = 'approved' and exists (select 1 from public.places p where p.id = place_id and p.publication_status = 'published'));
create policy reviews_read_own on public.place_reviews for select to authenticated
  using (author_id = (select auth.uid()));
create policy photos_read_public on public.place_photos for select to anon, authenticated
  using (status = 'approved' and uploaded and exists (select 1 from public.places p where p.id = place_id and p.publication_status = 'published'));
create policy photos_read_own on public.place_photos for select to authenticated
  using (uploader_id = (select auth.uid()));

-- ---------- 通報・投稿回数（非公開） ----------
create table private.ugc_flags (
  id bigint generated always as identity primary key,
  target_type text not null check (target_type in ('review', 'photo')),
  target_id uuid not null,
  reporter_id uuid not null references auth.users (id) on delete cascade,
  reason text not null check (reason in ('wrong_info', 'inappropriate', 'personal_info', 'spam', 'other')),
  created_at timestamptz not null default now(),
  unique (target_type, target_id, reporter_id)
);
create table private.ugc_quota (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  kind text not null check (kind in ('review', 'photo', 'flag')),
  count integer not null default 0,
  primary key (user_id, day, kind)
);
alter table private.ugc_flags enable row level security;
alter table private.ugc_quota enable row level security;
revoke all on private.ugc_flags, private.ugc_quota from anon, authenticated;

insert into private.app_settings (key, value) values
  ('ugc_publish_mode', '"immediate"'),   -- immediate：すぐ公開 / review_first：運営の承認後に公開
  ('ugc_auto_hide_flags', '3'),           -- この件数の通報で自動的に非表示（immediate のとき）
  ('review_daily_limit', '5'),
  ('photo_daily_limit', '5'),
  ('flag_daily_limit', '20')
on conflict (key) do nothing;

-- ---------- 共通の内部関数 ----------
create or replace function private.setting_int(p_key text, p_default integer) returns integer
language sql stable security definer set search_path = '' as $$
  select coalesce((select (value #>> '{}')::integer from private.app_settings where key = p_key), p_default)
$$;

create or replace function private.ugc_initial_status() returns public.ugc_status
language sql stable security definer set search_path = '' as $$
  select case when (select value #>> '{}' from private.app_settings where key = 'ugc_publish_mode') = 'review_first'
    then 'pending'::public.ugc_status else 'approved'::public.ugc_status end
$$;

-- 回数を1増やし、上限を超えたら例外（例外時は増加分も取り消される）
create or replace function private.consume_ugc_quota(p_uid uuid, p_kind text, p_limit integer) returns void
language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  insert into private.ugc_quota as q (user_id, day, kind, count)
  values (p_uid, (now() at time zone 'Asia/Tokyo')::date, p_kind, 1)
  on conflict (user_id, day, kind) do update set count = q.count + 1
  returning count into v_count;
  if v_count > p_limit then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
end $$;

create or replace function private.require_published(p_place_id uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.places where id = p_place_id and publication_status = 'published') then
    raise exception 'validation:place' using errcode = '22023';
  end if;
end $$;

-- ---------- 口コミの投稿・削除 ----------
create or replace function public.submit_place_review(
  p_request_id uuid, p_place_id uuid, p_nickname text, p_body text, p_tags public.review_tag[], p_visited_on date
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_status public.ugc_status;
  v_today date := (now() at time zone 'Asia/Tokyo')::date;
begin
  if v_uid is null then raise exception 'auth_required' using errcode = '28000'; end if;
  select id into v_id from public.place_reviews where author_id = v_uid and client_request_id = p_request_id;
  if v_id is not null then return v_id; end if;

  if p_request_id is null or char_length(btrim(coalesce(p_nickname, ''))) not between 1 and 20 then
    raise exception 'validation:nickname' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_body, ''))) not between 1 and 1000 then
    raise exception 'validation:body' using errcode = '22023';
  end if;
  if cardinality(coalesce(p_tags, '{}')) > 8 then raise exception 'validation:tags' using errcode = '22023'; end if;
  if p_visited_on is not null and (p_visited_on > v_today or p_visited_on < v_today - 730) then
    raise exception 'validation:visited_on' using errcode = '22023';
  end if;
  perform private.require_published(p_place_id);
  perform private.consume_ugc_quota(v_uid, 'review', private.setting_int('review_daily_limit', 5));

  v_status := private.ugc_initial_status();
  insert into public.place_reviews (place_id, author_id, nickname, body, tags, visited_on, status, published_at, client_request_id)
  values (p_place_id, v_uid, btrim(p_nickname), btrim(p_body), coalesce(p_tags, '{}'), p_visited_on, v_status,
          case when v_status = 'approved' then now() end, p_request_id)
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.delete_my_review(p_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'auth_required' using errcode = '28000'; end if;
  delete from public.place_reviews where id = p_id and author_id = auth.uid();
  return found;
end $$;

-- ---------- 写真：アップロード枠の確保 → Storage へアップロード → 完了 ----------
create or replace function public.begin_photo_upload(p_request_id uuid, p_place_id uuid, p_caption text)
returns table (photo_id uuid, storage_path text)
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_path text;
begin
  if v_uid is null then raise exception 'auth_required' using errcode = '28000'; end if;
  select p.id, p.storage_path into v_id, v_path from public.place_photos p
    where p.uploader_id = v_uid and p.client_request_id = p_request_id;
  if v_id is not null then
    photo_id := v_id; storage_path := v_path; return next; return;
  end if;
  if p_request_id is null then raise exception 'validation:request' using errcode = '22023'; end if;
  if char_length(coalesce(p_caption, '')) > 100 then raise exception 'validation:caption' using errcode = '22023'; end if;
  perform private.require_published(p_place_id);
  perform private.consume_ugc_quota(v_uid, 'photo', private.setting_int('photo_daily_limit', 5));

  v_id := gen_random_uuid();
  v_path := v_uid::text || '/' || v_id::text || '.jpg';
  insert into public.place_photos (id, place_id, uploader_id, storage_path, caption, client_request_id)
  values (v_id, p_place_id, v_uid, v_path, nullif(btrim(coalesce(p_caption, '')), ''), p_request_id);
  photo_id := v_id; storage_path := v_path; return next;
end $$;

create or replace function public.complete_photo_upload(p_photo_id uuid) returns public.ugc_status
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_path text;
  v_status public.ugc_status;
begin
  if v_uid is null then raise exception 'auth_required' using errcode = '28000'; end if;
  select storage_path into v_path from public.place_photos where id = p_photo_id and uploader_id = v_uid;
  if v_path is null then raise exception 'validation:photo' using errcode = '22023'; end if;
  -- Storage にファイルがあることを確認（パスの先頭フォルダは本人IDで、そこへ書けるのは本人だけ＝Storage のポリシー）
  if not exists (select 1 from storage.objects o where o.bucket_id = 'user-photos' and o.name = v_path) then
    raise exception 'validation:not_uploaded' using errcode = '22023';
  end if;
  update public.place_photos set uploaded = true,
    status = case when uploaded then status else private.ugc_initial_status() end,
    published_at = case when uploaded then published_at
                        when private.ugc_initial_status() = 'approved' then now() end
  where id = p_photo_id
  returning status into v_status;
  return v_status;
end $$;

-- 写真の行を削除（Storage のファイルはアプリが本人権限で先に削除する）
create or replace function public.delete_my_photo(p_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'auth_required' using errcode = '28000'; end if;
  delete from public.place_photos where id = p_id and uploader_id = auth.uid();
  return found;
end $$;

-- ---------- 通報（一定数で自動非表示） ----------
create or replace function public.flag_ugc(p_target_type text, p_target_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_count integer;
  v_threshold integer := private.setting_int('ugc_auto_hide_flags', 3);
begin
  if v_uid is null then raise exception 'auth_required' using errcode = '28000'; end if;
  if p_target_type not in ('review', 'photo') or p_reason not in ('wrong_info', 'inappropriate', 'personal_info', 'spam', 'other') then
    raise exception 'validation:flag' using errcode = '22023';
  end if;
  if p_target_type = 'review' and not exists (select 1 from public.place_reviews where id = p_target_id and status = 'approved') then
    raise exception 'validation:target' using errcode = '22023';
  end if;
  if p_target_type = 'photo' and not exists (select 1 from public.place_photos where id = p_target_id and status = 'approved') then
    raise exception 'validation:target' using errcode = '22023';
  end if;
  insert into private.ugc_flags (target_type, target_id, reporter_id, reason)
  values (p_target_type, p_target_id, v_uid, p_reason)
  on conflict (target_type, target_id, reporter_id) do nothing;
  if not found then return; end if; -- 同じ人の重複通報は数えない
  perform private.consume_ugc_quota(v_uid, 'flag', private.setting_int('flag_daily_limit', 20));

  select count(*) into v_count from private.ugc_flags where target_type = p_target_type and target_id = p_target_id;
  if v_count >= v_threshold then
    if p_target_type = 'review' then
      update public.place_reviews set status = 'hidden' where id = p_target_id and status = 'approved';
    else
      update public.place_photos set status = 'hidden' where id = p_target_id and status = 'approved';
    end if;
  end if;
end $$;

-- ---------- 一覧用の件数（公開中の口コミ・写真だけを数える） ----------
create or replace function public.place_ugc_counts(p_place_ids uuid[])
returns table (place_id uuid, review_count integer, photo_count integer)
language sql stable security definer set search_path = '' as $$
  select pl.id,
    (select count(*)::integer from public.place_reviews r where r.place_id = pl.id and r.status = 'approved'),
    (select count(*)::integer from public.place_photos f where f.place_id = pl.id and f.status = 'approved' and f.uploaded)
  from public.places pl
  where pl.id = any (p_place_ids[1:200]) and pl.publication_status = 'published'
$$;

-- ---------- 関数の実行権限 ----------
revoke all on function public.submit_place_review(uuid, uuid, text, text, public.review_tag[], date) from public, anon;
revoke all on function public.delete_my_review(uuid) from public, anon;
revoke all on function public.begin_photo_upload(uuid, uuid, text) from public, anon;
revoke all on function public.complete_photo_upload(uuid) from public, anon;
revoke all on function public.delete_my_photo(uuid) from public, anon;
revoke all on function public.flag_ugc(text, uuid, text) from public, anon;
grant execute on function public.submit_place_review(uuid, uuid, text, text, public.review_tag[], date) to authenticated;
grant execute on function public.delete_my_review(uuid) to authenticated;
grant execute on function public.begin_photo_upload(uuid, uuid, text) to authenticated;
grant execute on function public.complete_photo_upload(uuid) to authenticated;
grant execute on function public.delete_my_photo(uuid) to authenticated;
grant execute on function public.flag_ugc(text, uuid, text) to authenticated;
revoke all on function public.place_ugc_counts(uuid[]) from public;
grant execute on function public.place_ugc_counts(uuid[]) to anon, authenticated;
revoke all on function private.setting_int(text, integer), private.ugc_initial_status(),
  private.consume_ugc_quota(uuid, text, integer), private.require_published(uuid) from public, anon, authenticated;

-- ---------- Storage：非公開バケットと権限 ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('user-photos', 'user-photos', false, 5242880, array['image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Storage の権限判定から呼ぶ補助関数（列権限に左右されないよう security definer）。
-- private スキーマは anon/authenticated に見せないため、補助関数だけを置く専用スキーマを用意する。
create schema if not exists storage_rls;
revoke all on schema storage_rls from public;
grant usage on schema storage_rls to anon, authenticated;
create or replace function storage_rls.photo_upload_allowed(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.place_photos p
    where p.storage_path = p_name and p.uploader_id = auth.uid() and not p.uploaded)
$$;
create or replace function storage_rls.photo_is_public(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.place_photos p join public.places pl on pl.id = p.place_id
    where p.storage_path = p_name and p.status = 'approved' and p.uploaded and pl.publication_status = 'published')
$$;
revoke all on function storage_rls.photo_upload_allowed(text), storage_rls.photo_is_public(text) from public;
grant execute on function storage_rls.photo_upload_allowed(text), storage_rls.photo_is_public(text) to anon, authenticated;

-- アップロード：自分のフォルダに、確保済みの枠の名前でだけ
create policy user_photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'user-photos' and (storage.foldername(name))[1] = (select auth.uid())::text
              and storage_rls.photo_upload_allowed(name));
-- 閲覧：公開中の写真、または自分の写真
create policy user_photos_read on storage.objects for select to anon, authenticated
  using (bucket_id = 'user-photos' and (storage_rls.photo_is_public(name)
         or (storage.foldername(name))[1] = (select auth.uid())::text));
-- 削除：自分の写真だけ
create policy user_photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'user-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- 念のため private スキーマの関数は外部ロールから実行不可に戻す
revoke all on all functions in schema private from public, anon, authenticated;
