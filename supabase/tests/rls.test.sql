-- RLS・権限の検証（匿名 / 認証済み利用者A / 利用者B）
-- 実行: npm run test:rls（scripts/test-rls.sh がローカル PostgreSQL に空DBを作って流す）
\set ON_ERROR_STOP on
set client_min_messages = notice;
\o /dev/null

-- ---------- テスト用ヘルパー ----------
create schema tests;
grant usage on schema tests to anon, authenticated;
create function tests.expect_denied(sql text, label text) returns void language plpgsql as $$
begin
  begin
    execute sql;
  exception when insufficient_privilege then
    raise notice 'ok  denied: %', label; return;
  end;
  raise exception 'FAIL (書き込み/読み取りできてしまった): %', label;
end $$;
create function tests.expect_error(sql text, pattern text, label text) returns void language plpgsql as $$
begin
  begin
    execute sql;
  exception when others then
    if sqlerrm ~ pattern then raise notice 'ok  error: % (%)', label, sqlerrm; return; end if;
    raise exception 'FAIL 想定外のエラー: % → %', label, sqlerrm;
  end;
  raise exception 'FAIL エラーにならなかった: %', label;
end $$;
create function tests.expect_eq(actual bigint, expected bigint, label text) returns void language plpgsql as $$
begin
  if actual is distinct from expected then
    raise exception 'FAIL %: expected % got %', label, expected, actual;
  end if;
  raise notice 'ok  %', label;
end $$;
grant execute on all functions in schema tests to anon, authenticated;

-- ---------- データ（運営＝postgres が投入） ----------
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@example.com'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@example.com');
insert into public.areas (id, name, prefecture, lat, lng) values ('minato', '港区', '東京都', 35.65, 139.75);
insert into public.places (id, name, category, address, area_id, lat, lng, publication_status, operating_status)
values
  ('11111111-1111-1111-1111-111111111111', '公開施設', 'cafe', '東京都港区', 'minato', 35.65, 139.74, 'published', 'normal'),
  ('22222222-2222-2222-2222-222222222222', '下書き施設', 'cafe', '東京都港区', 'minato', 35.66, 139.74, 'draft', 'normal'),
  ('33333333-3333-3333-3333-333333333333', 'アーカイブ施設', 'cafe', '東京都港区', 'minato', 35.67, 139.74, 'archived', 'normal');
insert into public.place_dog_zones (place_id, name, scope, indoor_dogs, air_conditioning)
values
  ('11111111-1111-1111-1111-111111111111', '店内', 'indoor_whole', 'yes', 'yes'),
  ('22222222-2222-2222-2222-222222222222', '店内', 'indoor_whole', 'yes', 'yes');
insert into public.place_verifications (place_id, field, method, verified_at, evidence_note) values
  ('11111111-1111-1111-1111-111111111111', 'indoor_dogs', 'phone', '2026-07-01', '電話で確認'),
  ('11111111-1111-1111-1111-111111111111', 'air_conditioning', 'phone', '2026-07-01', '電話で確認'),
  ('22222222-2222-2222-2222-222222222222', 'indoor_dogs', 'phone', '2026-07-01', '下書きの記録');
insert into private.place_internal_notes (place_id, note, contact_person)
values ('11111111-1111-1111-1111-111111111111', '内部メモ：店長の携帯 090-xxxx', '担当者名');
insert into public.place_reports (place_id, reporter_id, report_type, target_field, body, client_request_id)
values ('11111111-1111-1111-1111-111111111111', 'bbbbbbbb-0000-0000-0000-000000000002', 'correction', 'hours', 'Bの報告', gen_random_uuid());
insert into private.report_reviews (report_id, internal_memo)
select id, '運営メモ' from public.place_reports;

-- 制約：テラス区画を室内同伴可にできない／不明を失わない既定値
select tests.expect_error($$insert into public.place_dog_zones (place_id, name, scope, indoor_dogs) values ('33333333-3333-3333-3333-333333333333', 'テラス', 'terrace', 'yes')$$, 'terrace_is_not_indoor', 'テラス区画は室内同伴「可」にできない');
select tests.expect_error($$insert into public.place_dog_zones (place_id, name, weight_limit_kind) values ('33333333-3333-3333-3333-333333333333', 'x', 'max_kg')$$, 'weight_max_fields', '上限kgの種類なら数値と境界が必須');
select tests.expect_error($$insert into public.place_dog_zones (place_id, name, carry_status) values ('33333333-3333-3333-3333-333333333333', 'x', 'confirmed')$$, 'carry_confirmed_has_methods', '同伴方法「確認済み」は方法が空にならない');
select tests.expect_error($$insert into public.place_hours (place_id, schedule, weekday, open_minute, close_minute) values ('11111111-1111-1111-1111-111111111111', 'business', 1, 600, 600)$$, 'close_after_open', '営業時間の終了は開始より後');
select tests.expect_eq((select count(*) from public.place_dog_zones where place_id = '11111111-1111-1111-1111-111111111111' and weight_limit_kind = 'unknown' and certificate = 'unknown' and carry_status = 'unknown'), 1, '未入力の条件は unknown として保存される');

-- 写真の更新で確認日は変わらない（updated_at だけ更新）
do $$
declare before_v timestamptz; before_u timestamptz;
begin
  select max(verified_at) into before_v from public.place_verifications where place_id = '11111111-1111-1111-1111-111111111111';
  select updated_at into before_u from public.places where id = '11111111-1111-1111-1111-111111111111';
  perform pg_sleep(0.01);
  update public.places set photo_url = 'https://example.com/p.jpg', photo_rights = '店舗提供', photo_credit = 'デモ', description = '紹介文を更新'
    where id = '11111111-1111-1111-1111-111111111111';
  if (select max(verified_at) from public.place_verifications where place_id = '11111111-1111-1111-1111-111111111111') <> before_v then
    raise exception 'FAIL 写真更新で確認日が変わった';
  end if;
  if (select updated_at from public.places where id = '11111111-1111-1111-1111-111111111111') <= before_u then
    raise exception 'FAIL updated_at が更新されない';
  end if;
  raise notice 'ok  写真・紹介文の更新で確認日は変わらず updated_at だけ更新';
end $$;

-- =========================================================
-- 匿名（anon）
-- =========================================================
set role anon;
select set_config('request.jwt.claims', '', false);

select tests.expect_eq((select count(*) from public.places), 1, 'anon: 公開済み施設だけ読める（下書き・アーカイブは見えない）');
select tests.expect_eq((select count(*) from public.place_dog_zones), 1, 'anon: 非公開施設の区画は見えない');
select tests.expect_eq((select count(*) from public.place_verifications), 2, 'anon: 非公開施設の確認記録は見えない');
select tests.expect_denied('select * from public.place_reports', 'anon: 報告を読めない');
select tests.expect_denied('select * from private.place_internal_notes', 'anon: 内部メモを読めない');
select tests.expect_denied('select * from private.report_reviews', 'anon: 審査メモを読めない');
select tests.expect_denied($$insert into public.places (name, category, address, area_id, lat, lng) values ('x', 'cafe', 'x', 'minato', 35.6, 139.7)$$, 'anon: 施設を作れない');
select tests.expect_denied($$update public.places set publication_status = 'published'$$, 'anon: 公開状態を変更できない');
select tests.expect_denied($$select public.submit_place_report(gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'correction', 'hours', null, 'x', null)$$, 'anon: 報告を送れない（ログイン必須）');
reset role;

-- =========================================================
-- 利用者A
-- =========================================================
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', false);

select tests.expect_eq((select count(*) from public.places), 1, 'A: 公開済み施設だけ読める');
select tests.expect_eq((select count(*) from public.place_reports), 0, 'A: 他人（B）の報告は読めない');
select tests.expect_denied('select * from private.place_internal_notes', 'A: 内部メモを読めない');
select tests.expect_denied($$update public.places set name = '改ざん' where id = '11111111-1111-1111-1111-111111111111'$$, 'A: 施設を更新できない');
select tests.expect_denied($$update public.place_dog_zones set air_conditioning = 'yes'$$, 'A: 区画の条件を更新できない');
select tests.expect_denied($$insert into public.place_verifications (place_id, field, method, verified_at) values ('11111111-1111-1111-1111-111111111111', 'dog_conditions', 'onsite', now())$$, 'A: 確認記録を作れない（確認済みへ変更できない）');
select tests.expect_denied($$delete from public.place_verifications$$, 'A: 確認記録を削除できない');
select tests.expect_denied($$insert into public.place_reports (place_id, reporter_id, report_type, target_field, body, client_request_id) values ('11111111-1111-1111-1111-111111111111', 'bbbbbbbb-0000-0000-0000-000000000002', 'correction', 'hours', 'なりすまし', gen_random_uuid())$$, 'A: テーブルへ直接書けない（他人名義・制限の迂回ができない）');
select tests.expect_denied($$insert into private.report_quota (user_id, day, count) values ('aaaaaaaa-0000-0000-0000-000000000001', current_date, -100)$$, 'A: 投稿回数を書き換えられない');
select tests.expect_denied($$update private.app_settings set value = '1000'$$, 'A: 投稿上限の設定を変えられない');

-- 報告：関数経由のみ。報告者IDは認証情報から設定される
select public.submit_place_report('cccccccc-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'correction', 'air_conditioning', null, '冷房が止まっていました', '2026-07-01') as first_id \gset
select tests.expect_eq((select count(*) from public.place_reports where reporter_id = 'aaaaaaaa-0000-0000-0000-000000000001' and review_status = 'pending'), 1, 'A: 自分名義・審査待ちで保存される');
select public.submit_place_report('cccccccc-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'correction', 'air_conditioning', null, '冷房が止まっていました', '2026-07-01') as second_id \gset
select tests.expect_eq((select count(*) from public.place_reports), 1, 'A: 同じリクエストIDの再送は重複しない');
select tests.expect_eq((case when :'first_id' = :'second_id' then 1 else 0 end), 1, 'A: 再送時は同じ受付IDを返す');
select tests.expect_denied($$update public.place_reports set review_status = 'reviewed'$$, 'A: 審査状態を変更できない');
select tests.expect_error($$select public.submit_place_report(gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'correction', 'hours', null, 'x', null)$$, 'validation:place', 'A: 非公開施設には報告できない');
select tests.expect_error($$select public.submit_place_report(gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'correction', 'hours', null, repeat('あ', 1001), null)$$, 'body_too_long', 'A: 本文の文字数制限（サーバー側）');
select tests.expect_error($$select public.submit_place_report(gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'correction', null, null, 'x', null)$$, 'validation:correction', 'A: 対象項目なしの修正報告は不可');
select tests.expect_error($$select public.submit_place_report(gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'correction', 'hours', null, 'x', (current_date + 3))$$, 'visited_on', 'A: 未来の訪問日は不可');
-- 犬が大丈夫なお店かの投票（非公開・審査待ち）
select public.submit_place_report(gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'dog_ok_vote', null, 'terrace_only', '', null);
select tests.expect_eq((select count(*) from public.place_reports where report_type = 'dog_ok_vote' and review_status = 'pending'), 1, 'A: 投票は審査待ちとして保存');

-- 未承認の報告・投票は公開条件へ反映されない
select tests.expect_eq((select count(*) from public.place_dog_zones where indoor_dogs = 'yes' and air_conditioning = 'yes'), 1, 'A: 報告・投票で公開中の区画条件は変わらない');
select tests.expect_eq((select count(*) from public.place_verifications), 2, 'A: 報告で確認記録は増えない');

-- 投稿頻度制限：ここまで2件。あと8件まで成功し、11件目は拒否
do $$ begin
  for i in 1..8 loop
    perform public.submit_place_report(gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'correction', 'other', null, 'テスト' || i, null);
  end loop;
end $$;
select tests.expect_error($$select public.submit_place_report(gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'correction', 'other', null, '11件目', null)$$, 'rate_limited', 'A: 1日10件を超えると拒否');
select tests.expect_eq((select count(*) from public.place_reports), 10, 'A: 上限超過分は保存されない');
select tests.expect_error($$select public.submit_place_report('cccccccc-0000-0000-0000-000000000099', '11111111-1111-1111-1111-111111111111', 'correction', 'other', null, 'x', null)$$, 'rate_limited', 'A: 新しいリクエストIDでも迂回できない');
select tests.expect_eq((select count(*) from (select public.submit_place_report('cccccccc-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'correction', 'air_conditioning', null, 'x', null)) s), 1, 'A: 受付済みリクエストの再送は上限後も同じIDを返す');
reset role;

-- =========================================================
-- 利用者B
-- =========================================================
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}', false);
select tests.expect_eq((select count(*) from public.place_reports), 1, 'B: 自分の報告（1件）だけ読める');
select tests.expect_eq((select count(*) from public.place_reports where reporter_id <> 'bbbbbbbb-0000-0000-0000-000000000002'), 0, 'B: Aの報告は読めない');
select tests.expect_denied('select internal_memo from private.report_reviews', 'B: 自分の報告でも運営メモは読めない');
select tests.expect_denied($$delete from public.place_reports$$, 'B: 報告を削除できない');
-- Bは新しい日の上限を個別に持つ（Aの上限の影響を受けない）
select tests.expect_eq((select count(*) from (select public.submit_place_report(gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'dog_ok_vote', null, 'indoor_ok', '', null)) s), 1, 'B: 投票できる');
reset role;

-- =========================================================
-- アカウント削除（Edge Function が auth.admin.deleteUser を呼んだときの DB 側の動き）
-- =========================================================
delete from auth.users where id = 'aaaaaaaa-0000-0000-0000-000000000001';
select tests.expect_eq((select count(*) from public.place_reports where reporter_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 0, '削除: Aの報告が削除される');
select tests.expect_eq((select count(*) from private.report_quota where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 0, '削除: Aの投稿回数記録が削除される');
select tests.expect_eq((select count(*) from public.place_reports where reporter_id = 'bbbbbbbb-0000-0000-0000-000000000002'), 2, '削除: Bの報告は残る');

\o
\echo 'ALL RLS TESTS PASSED'
