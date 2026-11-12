-- 「うちの子」基準・暑さ基準の機能（2026-11-14）
-- ・施設カテゴリの追加（ホームセンター／ペットショップ／公共施設）
-- ・犬同伴区画の詳細（犬種制限・頭数・床・犬用メニュー・席数）
-- ・口コミ／写真に「投稿した犬のサイズ・犬種」（任意。公開される）
-- ・暑さ指数（WBGT）の地点一覧と、Edge Function 用の取得キャッシュ
--
-- 注意：enum への値の追加は、同じトランザクション内でその値を使えない。
--       この migration ではカテゴリ値を追加するだけで、使うのは後の店舗登録。

-- ---------- 施設カテゴリ ----------
alter type public.place_category add value if not exists 'home_center';
alter type public.place_category add value if not exists 'pet_shop';
alter type public.place_category add value if not exists 'public_facility';

-- ---------- 犬同伴区画の詳細 ----------
create type public.breed_restriction as enum ('none', 'brachycephalic_ng', 'text_only', 'unknown');
create type public.max_dogs_kind as enum ('none', 'max', 'unknown');
create type public.floor_type as enum ('non_slip', 'slippery', 'mixed', 'unknown');
create type public.dog_size as enum ('small', 'medium', 'large');

alter table public.place_dog_zones
  add column breed_restriction public.breed_restriction not null default 'unknown',
  add column breed_text text check (char_length(breed_text) <= 200),
  add column max_dogs_kind public.max_dogs_kind not null default 'unknown',
  add column max_dogs smallint check (max_dogs between 1 and 20),
  add column floor_type public.floor_type not null default 'unknown',
  add column dog_menu public.tri_state not null default 'unknown',
  add column dog_seats smallint check (dog_seats between 0 and 500),
  add constraint max_dogs_fields check ((max_dogs_kind = 'max') = (max_dogs is not null)),
  add constraint breed_text_needed check (breed_restriction <> 'text_only' or char_length(coalesce(breed_text, '')) > 0);

-- ---------- 口コミ・写真の「投稿した犬」 ----------
alter table public.place_reviews
  add column dog_size public.dog_size,
  add column dog_breed text check (char_length(dog_breed) between 1 and 30);
alter table public.place_photos
  add column dog_size public.dog_size,
  add column dog_breed text check (char_length(dog_breed) between 1 and 30);

grant select (dog_size, dog_breed) on public.place_reviews to anon, authenticated;
grant select (dog_size, dog_breed) on public.place_photos to anon, authenticated;

create or replace function private.clean_dog_breed(p text) returns text
language sql immutable set search_path = '' as $$
  select nullif(btrim(regexp_replace(coalesce(p, ''), '[[:cntrl:]]', '', 'g')), '')
$$;

create or replace function public.submit_place_review_v2(
  p_request_id uuid, p_place_id uuid, p_nickname text, p_body text, p_tags public.review_tag[], p_visited_on date,
  p_dog_size public.dog_size, p_dog_breed text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_status public.ugc_status;
  v_today date := (now() at time zone 'Asia/Tokyo')::date;
  v_breed text := private.clean_dog_breed(p_dog_breed);
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
  if char_length(coalesce(v_breed, '')) > 30 then raise exception 'validation:dog_breed' using errcode = '22023'; end if;
  perform private.require_published(p_place_id);
  perform private.consume_ugc_quota(v_uid, 'review', private.setting_int('review_daily_limit', 5));

  v_status := private.ugc_initial_status();
  insert into public.place_reviews (place_id, author_id, nickname, body, tags, visited_on, dog_size, dog_breed, status, published_at, client_request_id)
  values (p_place_id, v_uid, btrim(p_nickname), btrim(p_body), coalesce(p_tags, '{}'), p_visited_on, p_dog_size, v_breed, v_status,
          case when v_status = 'approved' then now() end, p_request_id)
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.begin_photo_upload_v2(
  p_request_id uuid, p_place_id uuid, p_caption text, p_dog_size public.dog_size, p_dog_breed text
) returns table (photo_id uuid, storage_path text)
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_path text;
  v_breed text := private.clean_dog_breed(p_dog_breed);
begin
  if v_uid is null then raise exception 'auth_required' using errcode = '28000'; end if;
  select p.id, p.storage_path into v_id, v_path from public.place_photos p
    where p.uploader_id = v_uid and p.client_request_id = p_request_id;
  if v_id is not null then
    photo_id := v_id; storage_path := v_path; return next; return;
  end if;
  if p_request_id is null then raise exception 'validation:request' using errcode = '22023'; end if;
  if char_length(coalesce(p_caption, '')) > 100 then raise exception 'validation:caption' using errcode = '22023'; end if;
  if char_length(coalesce(v_breed, '')) > 30 then raise exception 'validation:dog_breed' using errcode = '22023'; end if;
  perform private.require_published(p_place_id);
  perform private.consume_ugc_quota(v_uid, 'photo', private.setting_int('photo_daily_limit', 5));

  v_id := gen_random_uuid();
  v_path := v_uid::text || '/' || v_id::text || '.jpg';
  insert into public.place_photos (id, place_id, uploader_id, storage_path, caption, dog_size, dog_breed, client_request_id)
  values (v_id, p_place_id, v_uid, v_path, nullif(btrim(coalesce(p_caption, '')), ''), p_dog_size, v_breed, p_request_id);
  photo_id := v_id; storage_path := v_path; return next;
end $$;

revoke all on function private.clean_dog_breed(text) from public;
revoke all on function public.submit_place_review_v2(uuid, uuid, text, text, public.review_tag[], date, public.dog_size, text) from public, anon;
revoke all on function public.begin_photo_upload_v2(uuid, uuid, text, public.dog_size, text) from public, anon;
grant execute on function public.submit_place_review_v2(uuid, uuid, text, text, public.review_tag[], date, public.dog_size, text) to authenticated;
grant execute on function public.begin_photo_upload_v2(uuid, uuid, text, public.dog_size, text) to authenticated;

-- ---------- 暑さ指数（環境省 熱中症予防情報サイトの地点） ----------
-- 位置は端末内で最寄り地点を選び、サーバーには地点番号だけを送る（利用者の位置を残さない）
create table public.wbgt_points (
  id text primary key check (id ~ '^\d{5}$'),
  name text not null check (char_length(name) between 1 and 40),
  lat double precision not null check (lat between 20 and 46),
  lng double precision not null check (lng between 122 and 154)
);
alter table public.wbgt_points enable row level security;
grant select on public.wbgt_points to anon, authenticated;
create policy wbgt_points_read on public.wbgt_points for select to anon, authenticated using (true);

-- Edge Function（service role）だけが使う取得キャッシュ
create table private.wbgt_cache (
  point_id text primary key references public.wbgt_points (id) on delete cascade,
  fetched_at timestamptz not null default now(),
  payload jsonb not null check (jsonb_typeof(payload) = 'object')
);
alter table private.wbgt_cache enable row level security;
revoke all on private.wbgt_cache from anon, authenticated;

-- private スキーマは API に出さないため、Edge Function からは service_role 専用の関数で読み書きする
create or replace function public.wbgt_cache_get(p_point_id text, p_max_age_seconds integer)
returns jsonb
language sql stable security definer set search_path = '' as $$
  select c.payload from private.wbgt_cache c
  where c.point_id = p_point_id and c.fetched_at > now() - make_interval(secs => greatest(p_max_age_seconds, 0))
$$;
create or replace function public.wbgt_cache_put(p_point_id text, p_payload jsonb)
returns void
language sql volatile security definer set search_path = '' as $$
  insert into private.wbgt_cache (point_id, fetched_at, payload) values (p_point_id, now(), p_payload)
  on conflict (point_id) do update set fetched_at = excluded.fetched_at, payload = excluded.payload
$$;
revoke all on function public.wbgt_cache_get(text, integer) from public, anon, authenticated;
revoke all on function public.wbgt_cache_put(text, jsonb) from public, anon, authenticated;
grant execute on function public.wbgt_cache_get(text, integer) to service_role;
grant execute on function public.wbgt_cache_put(text, jsonb) to service_role;
