-- 犬と涼める：初期スキーマ
-- 方針
--  * 不明は 'unknown' として保持（null を「制限なし」「可」にしない）
--  * 公開テーブル（public）は RLS で「公開済み施設とその付随データ」だけを匿名に読ませる
--  * 運営メモ・連絡先・設定・投稿回数は private スキーマ（API 非公開・一般ロールに権限なし）
--  * 一般利用者の書き込みは security definer 関数（submit_place_report）だけ。テーブルへの直接 insert は不可

create schema if not exists private;
revoke all on schema private from public;
-- Supabase では anon / authenticated / service_role ロールが存在する前提
revoke all on schema private from anon, authenticated;

-- ---------- enum ----------
create type public.tri_state as enum ('yes', 'no', 'unknown');
create type public.place_category as enum ('cafe', 'restaurant', 'commercial', 'other_rest');
create type public.publication_status as enum ('draft', 'published', 'archived');
create type public.operating_status as enum ('normal', 'temporarily_closed', 'closed', 'unknown');
create type public.zone_scope as enum ('indoor_whole', 'indoor_partial', 'private_room', 'terrace', 'other', 'unknown');
create type public.weight_limit_kind as enum ('none', 'max_kg', 'text_only', 'unknown');
create type public.carry_method as enum ('leash_floor', 'cart', 'bag', 'held');
create type public.confirm_status as enum ('confirmed', 'unknown');
create type public.certificate_requirement as enum ('not_required', 'required', 'unknown');
create type public.eligibility as enum ('open', 'guests_only', 'members_only', 'other_restricted', 'unknown');
create type public.fee_status as enum ('free', 'paid', 'unknown');
create type public.dog_hours_mode as enum ('same_as_business', 'custom', 'unknown');
create type public.hours_schedule as enum ('business', 'dog');
create type public.verification_field as enum ('indoor_dogs', 'air_conditioning', 'dog_conditions', 'usage_conditions', 'hours');
create type public.verification_method as enum ('official_info', 'phone', 'onsite', 'other');
create type public.report_type as enum ('correction', 'dog_ok_vote');
create type public.report_target_field as enum ('dog_zone', 'indoor_dogs', 'air_conditioning', 'dog_conditions', 'usage_conditions', 'hours', 'contact', 'closed', 'other');
create type public.dog_ok_vote_choice as enum ('indoor_ok', 'cart_or_bag_needed', 'terrace_only', 'not_allowed', 'unsure');
create type public.review_status as enum ('pending', 'reviewed', 'rejected');

-- ---------- エリア・駅（データ追加でエリア拡張） ----------
create table public.areas (
  id text primary key check (id ~ '^[a-z0-9-]{2,40}$'),
  name text not null check (char_length(name) between 1 and 40),
  prefecture text not null,
  lat double precision not null check (lat between 20 and 46),
  lng double precision not null check (lng between 122 and 154),
  is_active boolean not null default true
);

create table public.stations (
  id text primary key check (id ~ '^[a-z0-9-]{2,60}$'),
  name text not null check (char_length(name) between 1 and 40),
  area_id text not null references public.areas (id),
  lat double precision not null check (lat between 20 and 46),
  lng double precision not null check (lng between 122 and 154)
);

-- ---------- 施設 ----------
create table public.places (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  category public.place_category not null,
  address text not null check (char_length(address) between 1 and 200),
  area_id text not null references public.areas (id),
  lat double precision not null check (lat between 20 and 46),
  lng double precision not null check (lng between 122 and 154),
  timezone text not null default 'Asia/Tokyo' check (timezone = 'Asia/Tokyo'),
  publication_status public.publication_status not null default 'draft',
  operating_status public.operating_status not null default 'unknown',
  -- 利用条件
  eligibility public.eligibility not null default 'unknown',
  eligibility_text text check (char_length(eligibility_text) <= 200),
  order_required public.tri_state not null default 'unknown',
  order_text text check (char_length(order_text) <= 200),
  reservation_required public.tri_state not null default 'unknown',
  reservation_text text check (char_length(reservation_text) <= 200),
  fee_status public.fee_status not null default 'unknown',
  fee_text text check (char_length(fee_text) <= 200),
  water public.tri_state not null default 'unknown',
  -- 時間
  business_hours_status public.confirm_status not null default 'unknown',
  dog_hours_mode public.dog_hours_mode not null default 'unknown',
  -- 連絡先・写真（公開してよい店舗の情報のみ）
  phone text check (phone ~ '^\+?[0-9()\- ]{10,20}$'),
  official_url text check (official_url ~ '^https://[A-Za-z0-9.-]+\.[A-Za-z]{2,}(:[0-9]{1,5})?(/[^[:space:]]*)?$' and char_length(official_url) <= 2000),
  photo_url text check (photo_url ~ '^https://' and char_length(photo_url) <= 2000),
  photo_rights text check (char_length(photo_rights) <= 200), -- 例「店舗提供・掲載許諾あり」
  photo_credit text check (char_length(photo_credit) <= 200),
  description text check (char_length(description) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- 写真は権利・出典が揃っている場合だけ
  constraint photo_needs_rights check (photo_url is null or (photo_rights is not null and photo_credit is not null))
);
create index places_area_idx on public.places (area_id) where publication_status = 'published';

-- 犬同伴区画（MVP は 1施設1区画。将来は unique を外して複数区画へ）
create table public.place_dog_zones (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  scope public.zone_scope not null default 'unknown',
  indoor_dogs public.tri_state not null default 'unknown',
  air_conditioning public.tri_state not null default 'unknown',
  weight_limit_kind public.weight_limit_kind not null default 'unknown',
  weight_max_kg numeric(5, 1) check (weight_max_kg > 0 and weight_max_kg < 200),
  weight_max_inclusive boolean,
  weight_limit_text text check (char_length(weight_limit_text) <= 200),
  carry_status public.confirm_status not null default 'unknown',
  carry_methods public.carry_method[] not null default '{}',
  carry_text text check (char_length(carry_text) <= 200),
  certificate public.certificate_requirement not null default 'unknown',
  certificate_text text check (char_length(certificate_text) <= 200),
  -- [{ "text": "...", "effect": "needs_check" | "info" }]
  extra_requirements jsonb not null default '[]' check (jsonb_typeof(extra_requirements) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint terrace_is_not_indoor check (scope <> 'terrace' or indoor_dogs = 'no'),
  constraint weight_max_fields check (
    (weight_limit_kind = 'max_kg' and weight_max_kg is not null and weight_max_inclusive is not null)
    or (weight_limit_kind <> 'max_kg' and weight_max_kg is null and weight_max_inclusive is null)
  ),
  constraint weight_text_needed check (weight_limit_kind <> 'text_only' or char_length(coalesce(weight_limit_text, '')) > 0),
  constraint carry_confirmed_has_methods check (carry_status = 'unknown' or cardinality(carry_methods) > 0)
);
create unique index place_dog_zones_one_per_place on public.place_dog_zones (place_id); -- MVP 制約

-- 曜日別の時間帯。分単位。close_minute > 1440 は翌日にまたがる（18:00〜翌2:00 = 1080〜1560）
create table public.place_hours (
  id bigint generated always as identity primary key,
  place_id uuid not null references public.places (id) on delete cascade,
  schedule public.hours_schedule not null, -- business=営業時間 / dog=犬同伴可能時間
  weekday smallint not null check (weekday between 0 and 6), -- 0=日曜（Asia/Tokyo）
  open_minute smallint not null check (open_minute between 0 and 1439),
  close_minute smallint not null,
  constraint close_after_open check (close_minute > open_minute and close_minute <= open_minute + 1440)
);
create index place_hours_place_idx on public.place_hours (place_id);

-- 日付別の休業・時間変更（通常の営業時間より優先）
create table public.place_hour_exceptions (
  id bigint generated always as identity primary key,
  place_id uuid not null references public.places (id) on delete cascade,
  schedule public.hours_schedule not null default 'business',
  date date not null,
  is_closed boolean not null,
  open_minute smallint check (open_minute between 0 and 1439),
  close_minute smallint,
  note text check (char_length(note) <= 200),
  constraint exception_times check (
    (is_closed and open_minute is null and close_minute is null)
    or (not is_closed and open_minute is not null and close_minute > open_minute and close_minute <= open_minute + 1440)
  )
);
create index place_hour_exceptions_idx on public.place_hour_exceptions (place_id, date);

-- 確認記録（運営のみ作成。公開できる根拠だけを置く）
create table public.place_verifications (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places (id) on delete cascade,
  zone_id uuid references public.place_dog_zones (id) on delete cascade,
  field public.verification_field not null,
  method public.verification_method not null,
  verified_at timestamptz not null,
  evidence_url text check (evidence_url ~ '^https://' and char_length(evidence_url) <= 2000),
  evidence_note text check (char_length(evidence_note) <= 300),
  created_at timestamptz not null default now()
);
create index place_verifications_idx on public.place_verifications (place_id, field, verified_at desc);

-- ---------- 報告（利用者は submit_place_report 経由でのみ作成） ----------
create table public.place_reports (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places (id) on delete cascade,
  reporter_id uuid not null references auth.users (id) on delete cascade,
  report_type public.report_type not null,
  target_field public.report_target_field,
  vote_choice public.dog_ok_vote_choice,
  body text not null default '' check (char_length(body) <= 1000),
  visited_on date,
  received_at timestamptz not null default now(),
  review_status public.review_status not null default 'pending',
  client_request_id uuid not null,
  constraint report_shape check (
    (report_type = 'correction' and target_field is not null and vote_choice is null and char_length(btrim(body)) > 0)
    or (report_type = 'dog_ok_vote' and vote_choice is not null)
  ),
  constraint one_request_once unique (reporter_id, client_request_id)
);
create index place_reports_review_idx on public.place_reports (review_status, received_at);

-- ---------- 非公開（private） ----------
create table private.app_settings (
  key text primary key,
  value jsonb not null
);
insert into private.app_settings (key, value) values ('report_daily_limit', '10');

-- 運営の内部メモ・店舗担当者の連絡先など。公開テーブルのレスポンスに混ぜない
create table private.place_internal_notes (
  id bigint generated always as identity primary key,
  place_id uuid not null references public.places (id) on delete cascade,
  note text not null,
  contact_person text,
  created_at timestamptz not null default now()
);

create table private.report_reviews (
  report_id uuid primary key references public.place_reports (id) on delete cascade,
  internal_memo text,
  reviewed_by text,
  reviewed_at timestamptz not null default now()
);

-- 1ユーザー1日（Asia/Tokyo）あたりの投稿回数。迂回できないよう関数内でのみ更新
create table private.report_quota (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  count integer not null default 0,
  primary key (user_id, day)
);

-- ---------- updated_at（写真・紹介文の編集では確認日を変えない：確認日は place_verifications） ----------
create or replace function private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;
create trigger places_touch before update on public.places for each row execute function private.touch_updated_at();
create trigger zones_touch before update on public.place_dog_zones for each row execute function private.touch_updated_at();

-- ---------- 権限：まず全部外し、必要最小限だけ付与 ----------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all tables in schema private from anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;

alter table public.areas enable row level security;
alter table public.stations enable row level security;
alter table public.places enable row level security;
alter table public.place_dog_zones enable row level security;
alter table public.place_hours enable row level security;
alter table public.place_hour_exceptions enable row level security;
alter table public.place_verifications enable row level security;
alter table public.place_reports enable row level security;
alter table private.app_settings enable row level security;
alter table private.place_internal_notes enable row level security;
alter table private.report_reviews enable row level security;
alter table private.report_quota enable row level security;

grant usage on schema public to anon, authenticated;
grant select on public.areas, public.stations, public.places, public.place_dog_zones,
  public.place_hours, public.place_hour_exceptions, public.place_verifications to anon, authenticated;
grant select on public.place_reports to authenticated; -- 行は自分の報告だけ（RLS）

create policy areas_read on public.areas for select to anon, authenticated using (is_active);
create policy stations_read on public.stations for select to anon, authenticated
  using (exists (select 1 from public.areas a where a.id = area_id and a.is_active));
create policy places_read on public.places for select to anon, authenticated
  using (publication_status = 'published');
create policy zones_read on public.place_dog_zones for select to anon, authenticated
  using (exists (select 1 from public.places p where p.id = place_id and p.publication_status = 'published'));
create policy hours_read on public.place_hours for select to anon, authenticated
  using (exists (select 1 from public.places p where p.id = place_id and p.publication_status = 'published'));
create policy hour_exceptions_read on public.place_hour_exceptions for select to anon, authenticated
  using (exists (select 1 from public.places p where p.id = place_id and p.publication_status = 'published'));
create policy verifications_read on public.place_verifications for select to anon, authenticated
  using (exists (select 1 from public.places p where p.id = place_id and p.publication_status = 'published'));
create policy reports_read_own on public.place_reports for select to authenticated
  using (reporter_id = (select auth.uid()));
-- insert / update / delete のポリシーは作らない（= 一般ロールは不可）

-- ---------- 報告の受付（唯一の書き込み経路） ----------
create or replace function public.submit_place_report(
  p_request_id uuid,
  p_place_id uuid,
  p_report_type public.report_type,
  p_target_field public.report_target_field,
  p_vote_choice public.dog_ok_vote_choice,
  p_body text,
  p_visited_on date
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_existing uuid;
  v_limit integer;
  v_today date := (now() at time zone 'Asia/Tokyo')::date;
  v_count integer;
  v_id uuid;
  v_body text := btrim(coalesce(p_body, ''));
begin
  if v_uid is null then
    raise exception 'auth_required' using errcode = '28000';
  end if;

  -- 同じリクエストIDの再送は、新規作成せず既存の受付IDを返す（回数にも数えない）
  select id into v_existing from public.place_reports
    where reporter_id = v_uid and client_request_id = p_request_id;
  if v_existing is not null then
    return v_existing;
  end if;

  -- 入力検証（クライアントと同じ内容をサーバーでも実施）
  if p_request_id is null or p_place_id is null or p_report_type is null then
    raise exception 'validation:required' using errcode = '22023';
  end if;
  if char_length(v_body) > 1000 then
    raise exception 'validation:body_too_long' using errcode = '22023';
  end if;
  if p_report_type = 'correction' and (p_target_field is null or char_length(v_body) = 0 or p_vote_choice is not null) then
    raise exception 'validation:correction' using errcode = '22023';
  end if;
  if p_report_type = 'dog_ok_vote' and (p_vote_choice is null or p_target_field is not null) then
    raise exception 'validation:vote' using errcode = '22023';
  end if;
  if p_visited_on is not null and (p_visited_on > v_today or p_visited_on < v_today - 730) then
    raise exception 'validation:visited_on' using errcode = '22023';
  end if;
  if not exists (select 1 from public.places where id = p_place_id and publication_status = 'published') then
    raise exception 'validation:place' using errcode = '22023';
  end if;

  -- 投稿頻度制限（初期値 1日10件、private.app_settings で変更可）
  select coalesce((value #>> '{}')::integer, 10) into v_limit from private.app_settings where key = 'report_daily_limit';
  v_limit := coalesce(v_limit, 10);
  insert into private.report_quota as q (user_id, day, count) values (v_uid, v_today, 1)
    on conflict (user_id, day) do update set count = q.count + 1
    returning count into v_count;
  if v_count > v_limit then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  insert into public.place_reports (place_id, reporter_id, report_type, target_field, vote_choice, body, visited_on, client_request_id)
  values (p_place_id, v_uid, p_report_type, p_target_field, p_vote_choice, v_body, p_visited_on, p_request_id)
  returning id into v_id;
  -- review_status は常に pending。公開施設情報へは反映しない（運営が確認して別途更新）
  return v_id;
end $$;

revoke all on function public.submit_place_report(uuid, uuid, public.report_type, public.report_target_field, public.dog_ok_vote_choice, text, date) from public, anon;
grant execute on function public.submit_place_report(uuid, uuid, public.report_type, public.report_target_field, public.dog_ok_vote_choice, text, date) to authenticated;

-- 新しく作るテーブル・関数に既定で権限が付かないようにする（Supabase の既定付与への対策）
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges in schema private revoke all on tables from anon, authenticated;
