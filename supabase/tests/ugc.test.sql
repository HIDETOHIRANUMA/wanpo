-- 口コミ・犬の写真・店舗写真・通報・Storage 権限の検証（rls.test.sql の後に同じDBで実行）
\set ON_ERROR_STOP on
set client_min_messages = notice;
\o /dev/null

-- ---------- データ（運営＝postgres が投入） ----------
insert into auth.users (id, email) values
  ('c0000000-0000-0000-0000-00000000000c', 'c@example.com'),
  ('d0000000-0000-0000-0000-00000000000d', 'd@example.com'),
  ('e0000000-0000-0000-0000-00000000000e', 'e@example.com'),
  ('f0000000-0000-0000-0000-00000000000f', 'f@example.com');
insert into public.place_media (place_id, url, kind, caption, rights, credit) values
  ('11111111-1111-1111-1111-111111111111', 'https://example.com/a.jpg', 'exterior', '外観', '店舗提供・掲載許諾あり', '公開施設'),
  ('22222222-2222-2222-2222-222222222222', 'https://example.com/b.jpg', 'interior', '店内', '店舗提供・掲載許諾あり', '下書き施設');
update public.places set reservation_url = 'https://example.com/reserve', atmosphere_tags = '{明るい,ソファ席}'
  where id = '11111111-1111-1111-1111-111111111111';
select tests.expect_error($$update public.places set reservation_url = 'http://example.com/' where id = '11111111-1111-1111-1111-111111111111'$$, 'reservation_url', '予約URLは https のみ');
select tests.expect_error($$insert into public.place_media (place_id, url, kind, rights, credit) values ('11111111-1111-1111-1111-111111111111', 'https://example.com/c.jpg', 'exterior', '', 'x')$$, 'rights', '店舗写真は権利表記が必須');

-- =========================================================
-- 匿名
-- =========================================================
set role anon;
select set_config('request.jwt.claims', '', false);
select tests.expect_eq((select count(*) from public.place_media), 1, 'anon: 公開施設の店舗写真だけ読める');
select tests.expect_eq((select count(*) from public.places where reservation_url is not null and cardinality(atmosphere_tags) = 2), 1, 'anon: 予約URL・雰囲気タグを読める');
select tests.expect_denied($$select public.submit_place_review(gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'x', 'x', '{}', null)$$, 'anon: 口コミを投稿できない（ログイン必須）');
select tests.expect_denied($$select * from public.begin_photo_upload(gen_random_uuid(), '11111111-1111-1111-1111-111111111111', null)$$, 'anon: 写真を投稿できない');
select tests.expect_denied($$select public.flag_ugc('review', gen_random_uuid(), 'spam')$$, 'anon: 通報できない');
select tests.expect_denied($$select * from public.my_ugc_ids('11111111-1111-1111-1111-111111111111')$$, 'anon: 投稿IDの照会はできない');
select tests.expect_denied($$insert into storage.objects (bucket_id, name) values ('user-photos', 'x/y.jpg')$$, 'anon: Storage にアップロードできない');
select tests.expect_denied($$insert into public.place_media (place_id, url, kind, rights, credit) values ('11111111-1111-1111-1111-111111111111', 'https://example.com/x.jpg', 'exterior', 'x', 'x')$$, 'anon: 店舗写真を登録できない');
reset role;

-- =========================================================
-- 利用者C：口コミ
-- =========================================================
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"c0000000-0000-0000-0000-00000000000c","role":"authenticated"}', false);
select public.submit_place_review('cc000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', ' ぽち ', '店内がよく冷えていて快適でした', '{cool_inside,water_served}', current_date) as review1 \gset
select public.submit_place_review('cc000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'ぽち', '再送', '{}', null) as review1_again \gset
select tests.expect_eq((case when :'review1' = :'review1_again' then 1 else 0 end), 1, 'C: 同じリクエストIDの再送は同じ口コミIDを返す');
select tests.expect_eq((select count(*) from public.place_reviews where status = 'approved' and nickname = 'ぽち' and published_at is not null), 1, 'C: すぐ公開（前後の空白は除去）');
select tests.expect_denied($$select author_id from public.place_reviews$$, 'C: 投稿者IDの列は読めない');
select tests.expect_denied($$insert into public.place_reviews (place_id, author_id, nickname, body, client_request_id) values ('11111111-1111-1111-1111-111111111111', 'd0000000-0000-0000-0000-00000000000d', 'なりすまし', 'x', gen_random_uuid())$$, 'C: テーブルへ直接書けない');
select tests.expect_denied($$update public.place_reviews set status = 'approved'$$, 'C: 公開状態を変更できない');
select tests.expect_error($$select public.submit_place_review(gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'x', 'x', '{}', null)$$, 'validation:place', 'C: 非公開施設には投稿できない');
select tests.expect_error($$select public.submit_place_review(gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'x', repeat('あ', 1001), '{}', null)$$, 'validation:body', 'C: 本文は1000文字まで');
select tests.expect_error($$select public.submit_place_review(gen_random_uuid(), '11111111-1111-1111-1111-111111111111', '  ', 'x', '{}', null)$$, 'validation:nickname', 'C: ニックネーム必須');
select tests.expect_error($$select public.submit_place_review(gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'x', 'x', '{}', current_date + 2)$$, 'validation:visited_on', 'C: 未来の訪問日は不可');
-- 1日5件まで（ここまで1件）
do $$ begin
  for i in 2..5 loop
    perform public.submit_place_review(gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'ぽち', '口コミ' || i, '{}', null);
  end loop;
end $$;
select tests.expect_error($$select public.submit_place_review(gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'ぽち', '6件目', '{}', null)$$, 'rate_limited', 'C: 口コミは1日5件まで');
select tests.expect_eq((select count(*) from public.place_reviews), 5, 'C: 上限超過分は保存されない');

-- =========================================================
-- 利用者C：写真（枠の確保 → Storage へアップロード → 完了）
-- =========================================================
select photo_id as photo1, storage_path as path1 from public.begin_photo_upload('cc000000-0000-0000-0000-000000000101', '11111111-1111-1111-1111-111111111111', '涼しそうな顔') \gset
select tests.expect_eq((case when :'path1' like 'c0000000-0000-0000-0000-00000000000c/%.jpg' then 1 else 0 end), 1, 'C: 保存先は本人IDのフォルダ');
select tests.expect_error($$select public.complete_photo_upload('$$ || :'photo1' || $$')$$, 'not_uploaded', 'C: ファイルが無いと完了できない');
select tests.expect_denied($$insert into storage.objects (bucket_id, name) values ('user-photos', 'c0000000-0000-0000-0000-00000000000c/free.jpg')$$, 'C: 枠のない名前ではアップロードできない');
insert into storage.objects (bucket_id, name, owner) values ('user-photos', :'path1', 'c0000000-0000-0000-0000-00000000000c');
reset role;
set role anon;
select set_config('request.jwt.claims', '', false);
select tests.expect_eq((select count(*) from public.place_photos), 0, 'anon: 完了前の写真は見えない');
select tests.expect_eq((select count(*) from storage.objects), 0, 'anon: 完了前の写真ファイルは読めない');
reset role;
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"c0000000-0000-0000-0000-00000000000c","role":"authenticated"}', false);
select tests.expect_eq((select count(*) from (select public.complete_photo_upload(:'photo1') as s) x where s = 'approved'), 1, 'C: 完了するとすぐ公開');
select tests.expect_denied($$insert into storage.objects (bucket_id, name) values ('user-photos', '$$ || :'path1' || $$x')$$, 'C: 完了後に同じ枠へ追加アップロードできない');
select tests.expect_denied($$select uploader_id from public.place_photos$$, 'C: 写真の投稿者IDの列は読めない');
select tests.expect_eq((select count(*) from public.my_ugc_ids('11111111-1111-1111-1111-111111111111')), 6, 'C: 自分の投稿IDだけ取得できる（口コミ5・写真1）');
select photo_id as photo2, storage_path as path2 from public.begin_photo_upload('cc000000-0000-0000-0000-000000000102', '11111111-1111-1111-1111-111111111111', null) \gset
reset role;

-- 利用者Dは他人のフォルダに書けない・消せない
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"d0000000-0000-0000-0000-00000000000d","role":"authenticated"}', false);
select tests.expect_denied($$insert into storage.objects (bucket_id, name) values ('user-photos', '$$ || :'path2' || $$')$$, 'D: 他人の枠にはアップロードできない');
select tests.expect_error($$select public.complete_photo_upload('$$ || :'photo2' || $$')$$, 'validation:photo', 'D: 他人の写真を完了にできない');
delete from storage.objects where name = :'path1';
select tests.expect_eq((select count(*) from public.place_photos where status = 'approved'), 1, 'D: 公開中の他人の写真は見える');
select tests.expect_eq((select count(*) from storage.objects), 1, 'D: 公開中の写真ファイルは読める（未完了の枠は見えない）');
select tests.expect_eq((select count(*) from (select public.delete_my_review(:'review1') as ok) x where ok), 0, 'D: 他人の口コミは削除できない');
select tests.expect_eq((select count(*) from (select public.delete_my_photo(:'photo1') as ok) x where ok), 0, 'D: 他人の写真は削除できない');
reset role;
select tests.expect_eq((select count(*) from storage.objects where name = :'path1'), 1, 'D: 他人の写真ファイルを削除できない');

-- =========================================================
-- 通報：同じ人の重複は数えず、3人目で自動非表示
-- =========================================================
set role anon;
select set_config('request.jwt.claims', '', false);
select tests.expect_eq((select review_count from public.place_ugc_counts(array['11111111-1111-1111-1111-111111111111'::uuid, '22222222-2222-2222-2222-222222222222'::uuid])), 5, 'anon: 一覧用の口コミ件数');
select tests.expect_eq((select count(*) from public.place_ugc_counts(array['22222222-2222-2222-2222-222222222222'::uuid])), 0, 'anon: 非公開施設の件数は返さない');
reset role;
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"d0000000-0000-0000-0000-00000000000d","role":"authenticated"}', false);
select public.flag_ugc('review', :'review1', 'inappropriate');
select public.flag_ugc('review', :'review1', 'spam');
select public.flag_ugc('photo', :'photo1', 'personal_info');
select tests.expect_error($$select public.flag_ugc('review', '$$ || :'review1' || $$', 'dislike')$$, 'validation:flag', 'D: 通報理由は決められた値だけ');
select tests.expect_denied($$select * from private.ugc_flags$$, 'D: 通報の記録は読めない');
select tests.expect_eq((select count(*) from public.my_ugc_ids('11111111-1111-1111-1111-111111111111')), 0, 'D: 他人の投稿IDは取得できない');
select tests.expect_eq((select count(*) from public.place_reviews where id = :'review1'), 1, 'D: 通報1人目では非表示にならない');
select set_config('request.jwt.claims', '{"sub":"e0000000-0000-0000-0000-00000000000e","role":"authenticated"}', false);
select public.flag_ugc('review', :'review1', 'inappropriate');
select public.flag_ugc('photo', :'photo1', 'personal_info');
select tests.expect_eq((select count(*) from public.place_reviews where id = :'review1'), 1, 'E: 通報2人目では非表示にならない（同じ人の重複は数えない）');
select set_config('request.jwt.claims', '{"sub":"f0000000-0000-0000-0000-00000000000f","role":"authenticated"}', false);
select public.flag_ugc('review', :'review1', 'wrong_info');
select public.flag_ugc('photo', :'photo1', 'personal_info');
select tests.expect_eq((select count(*) from public.place_reviews where id = :'review1'), 0, 'F: 3人目の通報で口コミが非表示');
select tests.expect_eq((select count(*) from public.place_photos where id = :'photo1'), 0, 'F: 3人目の通報で写真が非表示');
select tests.expect_eq((select count(*) from storage.objects where name = :'path1'), 0, 'F: 非表示の写真ファイルは他人から読めない');
select tests.expect_error($$select public.flag_ugc('review', '$$ || :'review1' || $$', 'spam')$$, 'validation:target', 'F: 非表示の投稿は通報対象外');
select set_config('request.jwt.claims', '{"sub":"c0000000-0000-0000-0000-00000000000c","role":"authenticated"}', false);
select tests.expect_eq((select count(*) from public.place_reviews where id = :'review1' and status = 'hidden'), 1, 'C: 自分の投稿は非表示でも見える（状態を確認できる）');
select tests.expect_eq((select count(*) from storage.objects where name = :'path1'), 1, 'C: 自分の写真ファイルは非表示でも読める');
select tests.expect_eq((select count(*) from (select public.delete_my_review(:'review1') as ok) x where ok), 1, 'C: 自分の口コミを削除できる');
delete from storage.objects where name = :'path1';
select tests.expect_eq((select count(*) from (select public.delete_my_photo(:'photo1') as ok) x where ok), 1, 'C: 自分の写真を削除できる');
reset role;
select tests.expect_eq((select count(*) from storage.objects where name = :'path1'), 0, 'C: 自分の写真ファイルを削除できる');
-- 運営が非表示にする（SQL エディタ等から）
update public.place_reviews set status = 'hidden' where body = '口コミ2';
set role anon;
select set_config('request.jwt.claims', '', false);
select tests.expect_eq((select count(*) from public.place_reviews), 3, 'anon: 運営が非表示にした口コミは見えない');
reset role;

-- =========================================================
-- 事前確認モード（設定で切替）
-- =========================================================
update private.app_settings set value = '"review_first"' where key = 'ugc_publish_mode';
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"d0000000-0000-0000-0000-00000000000d","role":"authenticated"}', false);
select public.submit_place_review(gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'しろ', '確認待ちの口コミ', '{quiet}', null) as review_d \gset
select tests.expect_eq((select count(*) from public.place_reviews where id = :'review_d' and status = 'pending' and published_at is null), 1, 'D: 事前確認モードでは確認待ち（本人には見える）');
reset role;
set role anon;
select set_config('request.jwt.claims', '', false);
select tests.expect_eq((select count(*) from public.place_reviews where body = '確認待ちの口コミ'), 0, 'anon: 確認待ちの口コミは見えない');
reset role;
update private.app_settings set value = '"immediate"' where key = 'ugc_publish_mode';

-- =========================================================
-- アカウント削除
-- =========================================================
delete from auth.users where id = 'c0000000-0000-0000-0000-00000000000c';
select tests.expect_eq((select count(*) from public.place_reviews where body like '口コミ%'), 0, '削除: Cの口コミが削除される');
select tests.expect_eq((select count(*) from public.place_photos), 0, '削除: Cの写真の記録が削除される');
select tests.expect_eq((select count(*) from private.ugc_quota where user_id = 'c0000000-0000-0000-0000-00000000000c'), 0, '削除: Cの投稿回数記録が削除される');
delete from auth.users where id = 'd0000000-0000-0000-0000-00000000000d';
select tests.expect_eq((select count(*) from private.ugc_flags where reporter_id = 'd0000000-0000-0000-0000-00000000000d'), 0, '削除: Dの通報記録が削除される');

\o
\echo 'ALL UGC TESTS PASSED'
