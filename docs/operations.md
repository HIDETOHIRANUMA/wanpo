# 運営の確認手順（Supabase Studio）

管理アプリは作らず、Supabase Studio（Dashboard）と投入スクリプトで運用します。Studio は管理者権限で接続するため RLS の影響を受けません。**本番データの変更は取り消しにくいため、SQL は実行前に対象の行を `select` で確認してください。**

## 1. 登録（下書き）

- 推奨：`templates/places.template.json` を元に作成 → `npm run import:places -- <file> --check` で検証 → `--sql` で SQL を作り SQL Editor で実行（または `--db`）。
- 手入力：Table Editor で `places` に行を追加（`publication_status = draft`）→ `place_dog_zones` に1行（MVPは1施設1区画）→ `place_hours` / `place_hour_exceptions`。
- 未確認の項目は `unknown` のまま。推測で `yes` / `none` にしない。
- 「小型犬のみ」などは `weight_limit_kind = text_only` と原文。kg に換算しない。
- 「大型犬はカート必須」など分岐のある条件は `extra_requirements` に `{"text": "...", "effect": "needs_check"}`。
- 写真は権利（`photo_rights`）と出典（`photo_credit`）が揃うものだけ。生成画像で代用しない。

## 2. 根拠の確認と確認記録

`place_verifications` に、項目ごとに1行追加します（上書きではなく追加。履歴が残ります）。

| field | 内容 |
| --- | --- |
| indoor_dogs | この区画で犬が室内に入れるか |
| air_conditioning | この区画に冷房があるか |
| dog_conditions | 体重・同伴方法・証明書・追加条件 |
| usage_conditions | 注文・予約・料金・利用資格・水 |
| hours | 営業時間・犬同伴可能時間 |

- `method`：`official_info`（店舗公式情報）／`phone`（店舗への電話確認）／`onsite`（運営者の現地確認）／`other`
- `evidence_url` または `evidence_note` に**公開してよい**根拠だけを書く（店員の個人名・個人の連絡先は書かない。必要なら `private.place_internal_notes` へ）。
- **確認日は `verified_at`。** 写真や紹介文を直しても確認日は変わりません（`places.updated_at` だけが変わります）。
- 室内同伴・冷房の値が `yes` でも、確認記録がなければアプリは「未確認」と表示し、主検索に入れません。

## 3. 公開

```sql
-- 公開前の確認
select p.name, z.scope, z.indoor_dogs, z.air_conditioning,
  (select array_agg(distinct field) from public.place_verifications v where v.place_id = p.id) as verified
from public.places p join public.place_dog_zones z on z.place_id = p.id
where p.id = '<id>';

update public.places set publication_status = 'published' where id = '<id>';
```

非公開に戻す：`publication_status = 'archived'`。アプリの保存一覧では「現在の掲載情報を確認できません」と表示され、電話・経路が無効になります。

## 4. 報告・回答の確認

利用者の報告（`report_type = correction`）と「犬と過ごせたか」の回答（`dog_ok_vote`）は `public.place_reports` に `pending` で届きます。**公開も自動反映もされません。**

```sql
select r.received_at, p.name, r.report_type, r.target_field, r.vote_choice, r.body, r.visited_on
from public.place_reports r join public.places p on p.id = r.place_id
where r.review_status = 'pending' order by r.received_at;
```

- 内容を店舗の公式情報・電話・現地で確認する（報告だけで確認済みにしない）。
- 審査の記録：
  ```sql
  update public.place_reports set review_status = 'reviewed' where id = '<report id>';  -- または 'rejected'
  insert into private.report_reviews (report_id, internal_memo, reviewed_by) values ('<report id>', '電話で確認、テラスのみに変更', '運営');
  ```
- 内部メモは `private` スキーマ（API 非公開）。公開テーブルに書かない。
- 報告者のメールアドレスは Authentication → Users でのみ確認できます。必要がない限り参照しません。

## 5. 更新

1. 施設・区画の値を修正（Table Editor または再投入）。
2. 確認した項目の `place_verifications` を**新しく追加**（確認日が更新される）。
3. 一時休業・閉業は `operating_status`、日付別の休業・時間変更は `place_hour_exceptions`。

## 6. 設定

- 報告の1日上限（既定10件／ユーザー／日・Asia/Tokyo）：
  ```sql
  update private.app_settings set value = '20' where key = 'report_daily_limit';
  ```
- 「再確認をおすすめ」の日数はアプリの `EXPO_PUBLIC_STALE_AFTER_DAYS`（既定90。運用上の目安）。

## 7. エリア・駅の追加（全国展開）

市区町村（`public.areas`）と駅（`public.stations`）は CSV から投入します。

```bash
npm run import:geo -- --areas data/areas.csv --stations data/stations.csv --check   # 検証だけ
npm run import:geo -- --areas data/areas.csv --stations data/stations.csv --sql out/geo.sql
DATABASE_URL='postgresql://...' npm run import:geo -- --areas data/areas.csv --stations data/stations.csv --db
```

- 書式：`templates/areas.template.csv`（`id,name,prefecture,prefecture_code,municipality_code,lat,lng`）、`templates/stations.template.csv`（`id,name,area_id,line_name,operator,lat,lng`）。
- 元データの例：市区町村は総務省「全国地方公共団体コード」と代表点の座標、駅は国土数値情報「鉄道データ（N02）」の駅の位置。**利用規約と出典表記の条件は、使う時点の最新の規約を確認してください（未確認）。** N02 の駅は線形データなので、代表点（中点など）を座標にし、所在の市区町村を `area_id` に入れた CSV に変換してから投入します。
- アプリは「都道府県 → 市区町村」と「駅名検索（最大30件）」で基準点を選び、基準点から選んだ距離の範囲にある施設だけを取得します。全国の施設を一度に読み込みません。
- アプリは前回の基準点（エリア・駅・地図の中心）を端末に覚え、初回は「東京都心（港区周辺）」から始まります（`src/data/demo/areas.ts` の `DEFAULT_ORIGIN`）。

## 8. 店舗写真・予約ページ・雰囲気タグ

- 店舗写真は `public.place_media`（`kind`：exterior 外観 / interior 店内 / atmosphere 雰囲気 / dog_area 犬と過ごせる席）。**掲載許諾などの権利（`rights`）と出典（`credit`）が必須**です。店舗から提供を受けた写真、または運営が撮影し店舗の許可を得た写真だけを登録し、他サービス・SNSの写真は使わないでください。
- 一覧のカードは「外観 → 犬と過ごせる席 → 店内 → 雰囲気」の順で1枚を表示します。写真がない施設はイメージイラスト（「イメージ（写真未登録）」と表示）になります。
- 予約ページは `places.reservation_url`（https のみ）。店舗の公式予約ページか、予約サービス上の店舗ページを登録します。アフィリエイト等の契約が必要なリンクは対象外です。
- 雰囲気タグは `places.atmosphere_tags`（最大6個・1つ20文字まで。例「明るい」「ソファ席」）。
- 施設の投入（`import:places`）で `reservation_url`、`atmosphere_tags`（CSV は `|` 区切り）、`media`（JSON の配列）を指定できます（`templates/places.template.*`）。

## 9. 口コミ・犬の写真の管理

投稿はすぐ公開され、通報が一定数たまると自動で非表示になります。口コミ・写真は施設の判定（室内同伴・冷房・犬の条件）には使いません。

- 最近の投稿を見る：
  ```sql
  select id, place_id, nickname, left(body, 60) as body, status, published_at from public.place_reviews order by created_at desc limit 50;
  select id, place_id, storage_path, caption, status, uploaded, published_at from public.place_photos order by created_at desc limit 50;
  ```
- 通報の多い投稿：
  ```sql
  select target_type, target_id, count(*) as flags, array_agg(distinct reason) as reasons
  from private.ugc_flags group by 1, 2 order by flags desc limit 50;
  ```
- 非表示にする／戻す（`hidden` は通報や運営判断、`rejected` は掲載見送り、`approved` は公開）：
  ```sql
  update public.place_reviews set status = 'hidden' where id = '...';
  update public.place_photos  set status = 'approved', published_at = coalesce(published_at, now()) where id = '...';
  ```
  写真ファイルそのものを消す場合は、Studio の Storage → `user-photos` から該当ファイル（`{投稿者ID}/{写真ID}.jpg`）を削除し、行も削除します。
- 投稿者の特定が必要な場合（法的な要請など）だけ、Studio で `author_id` / `uploader_id` を参照します。アプリの公開レスポンスには含まれません。

### 設定（`private.app_settings`）

| key | 既定 | 意味 |
| --- | --- | --- |
| `ugc_publish_mode` | `"immediate"` | `"immediate"`：すぐ公開／`"review_first"`：運営が `approved` にするまで非公開 |
| `ugc_auto_hide_flags` | `3` | この人数から通報されたら自動で非表示（同じ人の重複は数えない） |
| `review_daily_limit` | `5` | 口コミの1日の上限（1人あたり・日本時間） |
| `photo_daily_limit` | `5` | 写真の1日の上限 |
| `flag_daily_limit` | `20` | 通報の1日の上限 |

```sql
update private.app_settings set value = '"review_first"' where key = 'ugc_publish_mode';
update private.app_settings set value = '5' where key = 'ugc_auto_hide_flags';
```
