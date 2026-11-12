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

## 7. エリアの追加

`public.areas` と `public.stations` に行を追加します（`supabase/seed/areas_stations.sql` と同じ形式）。投入スクリプトは DB の `areas` を参照して未登録エリアを拒否します。
アプリの「対象エリア全体」の基準点（`src/data/demo/areas.ts` の `ALL_AREA_ORIGIN`）は3区の中心付近で固定しているため、大きく範囲を広げる場合は見直してください。
