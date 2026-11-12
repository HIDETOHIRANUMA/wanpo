-- 犬の詳細・投稿した犬・暑さ指数の地点（ugc.test.sql の後に同じDBで実行）
\set ON_ERROR_STOP on
set client_min_messages = notice;
\o /dev/null

-- ---------- データ（運営＝postgres が投入） ----------
grant usage on schema tests to service_role;
grant execute on all functions in schema tests to service_role;
insert into auth.users (id, email) values
  ('90000000-0000-0000-0000-000000000009', 'g@example.com');
update public.place_dog_zones set breed_restriction = 'brachycephalic_ng', max_dogs_kind = 'max', max_dogs = 2,
  floor_type = 'non_slip', dog_menu = 'yes', dog_seats = 12
  where place_id = '11111111-1111-1111-1111-111111111111';
insert into public.wbgt_points (id, name, lat, lng) values ('44132', '東京', 35.69167, 139.75), ('62078', '大阪', 34.68167, 135.51833);

select tests.expect_error($$update public.place_dog_zones set max_dogs_kind = 'max', max_dogs = null where place_id = '11111111-1111-1111-1111-111111111111'$$, 'max_dogs_fields', '頭数上限の種類なら数値が必須');
select tests.expect_error($$update public.place_dog_zones set max_dogs_kind = 'none', max_dogs = 3 where place_id = '11111111-1111-1111-1111-111111111111'$$, 'max_dogs_fields', '上限なしなら数値は持たない');
select tests.expect_error($$update public.place_dog_zones set breed_restriction = 'text_only', breed_text = null where place_id = '11111111-1111-1111-1111-111111111111'$$, 'breed_text_needed', '文章だけの犬種制限は本文が必須');
select tests.expect_error($$insert into public.wbgt_points (id, name, lat, lng) values ('1234', 'x', 35, 139)$$, 'wbgt_points_id_check', '地点番号は5桁');

-- =========================================================
-- 匿名
-- =========================================================
set role anon;
select set_config('request.jwt.claims', '', false);
select tests.expect_eq((select count(*) from public.place_dog_zones where breed_restriction = 'brachycephalic_ng' and max_dogs = 2 and floor_type = 'non_slip' and dog_menu = 'yes' and dog_seats = 12), 1, 'anon: 犬の詳細を読める');
select tests.expect_eq((select count(*) from public.wbgt_points), 2, 'anon: 暑さ指数の地点一覧を読める');
select tests.expect_denied($$insert into public.wbgt_points (id, name, lat, lng) values ('99999', 'x', 35, 139)$$, 'anon: 地点を追加できない');
select tests.expect_denied($$select public.wbgt_cache_get('44132', 1800)$$, 'anon: キャッシュを読めない');
select tests.expect_denied($$select public.wbgt_cache_put('44132', '{"status":"ok"}')$$, 'anon: キャッシュを書けない');
select tests.expect_denied($$select * from private.wbgt_cache$$, 'anon: キャッシュの表は見えない');
select tests.expect_denied($$select public.submit_place_review_v2(gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'x', 'x', '{}', null, 'small', null)$$, 'anon: 口コミ（v2）を投稿できない');
select tests.expect_denied($$select * from public.begin_photo_upload_v2(gen_random_uuid(), '11111111-1111-1111-1111-111111111111', null, 'small', null)$$, 'anon: 写真（v2）を投稿できない');
reset role;

-- =========================================================
-- 利用者G：投稿した犬のサイズ・犬種
-- =========================================================
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"90000000-0000-0000-0000-000000000009","role":"authenticated"}', false);
select public.submit_place_review_v2('99000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'まめ', '床が滑らず安心でした', '{spacious}', null, 'small', ' 柴犬 ') as review_g \gset
select tests.expect_eq((select count(*) from public.place_reviews where id = :'review_g' and dog_size = 'small' and dog_breed = '柴犬'), 1, 'G: 犬のサイズと犬種（前後の空白は除去）が保存される');
select tests.expect_eq((select count(*) from (select public.submit_place_review_v2('99000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'まめ', '再送', '{}', null, null, null) as id) x where x.id = :'review_g'), 1, 'G: 同じリクエストIDの再送は同じ口コミIDを返す');
select tests.expect_error($$select public.submit_place_review_v2(gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'x', 'x', '{}', null, null, repeat('あ', 31))$$, 'validation:dog_breed', 'G: 犬種は30文字まで');
select public.submit_place_review_v2(gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'まめ', '犬の情報なし', '{}', null, null, '   ') as review_g2 \gset
select tests.expect_eq((select count(*) from public.place_reviews where id = :'review_g2' and dog_size is null and dog_breed is null), 1, 'G: 犬の情報は省略できる（空白だけの犬種は未入力）');
select tests.expect_eq((select count(*) from (select public.submit_place_review(gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'まめ', '旧版アプリから', '{}', null) as id) x), 1, 'G: 旧版アプリの投稿関数も使える');
select photo_id as photo_g from public.begin_photo_upload_v2('99000000-0000-0000-0000-000000000101', '11111111-1111-1111-1111-111111111111', 'ひと休み', 'large', 'ゴールデン') \gset
select tests.expect_eq((select count(*) from public.place_photos where id = :'photo_g' and dog_size = 'large' and dog_breed = 'ゴールデン'), 1, 'G: 写真にも犬のサイズと犬種が保存される');
select tests.expect_denied($$select uploader_id from public.place_photos$$, 'G: 写真の投稿者IDの列は読めない（v2でも）');
select tests.expect_denied($$select public.wbgt_cache_get('44132', 1800)$$, 'G: ログイン中でもキャッシュは読めない');
reset role;

set role anon;
select set_config('request.jwt.claims', '', false);
select tests.expect_eq((select count(*) from public.place_reviews where dog_size = 'small' and dog_breed = '柴犬'), 1, 'anon: 公開中の口コミの犬のサイズ・犬種を読める');
select tests.expect_denied($$select author_id from public.place_reviews$$, 'anon: 投稿者IDは読めない');
reset role;

-- =========================================================
-- Edge Function（service role）用のキャッシュ
-- =========================================================
set role service_role;
select public.wbgt_cache_put('44132', '{"status":"ok","issued_at":null,"hourly":[]}');
select tests.expect_eq((select count(*) from (select public.wbgt_cache_get('44132', 1800) as p) x where x.p ->> 'status' = 'ok'), 1, 'service: 30分以内のキャッシュを読める');
select tests.expect_eq((select count(*) from (select public.wbgt_cache_get('44132', 0) as p) x where x.p is null), 1, 'service: 期限切れのキャッシュは返さない');
reset role;

delete from auth.users where id = '90000000-0000-0000-0000-000000000009';
select tests.expect_eq((select count(*) from public.place_reviews where dog_breed = '柴犬'), 0, '削除: Gの口コミが削除される');

\o
\echo 'ALL DOG-FIRST TESTS PASSED'
