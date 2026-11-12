# 引継ぎ資料（2026-11-12 時点）

「犬と涼める」の残り作業を引き継ぐための資料です。最初にこのファイルと、ルートの `AGENTS.md`（作業ルール）を読んでください。
実装済み／未検証の一覧は `docs/status.md`、リリースまでの手順は `docs/release-checklist.md` にあります。

## 1. いまの状態

- リポジトリ：GitHub `HIDETOHIRANUMA/wanpo`。作業ブランチは `claude/mvp`（PR #1・draft）。`main` は README だけ。
- 構成：Expo SDK 58 / React Native 0.88.1 / Expo Router（`src/app`）/ react-native-maps / supabase-js。TypeScript。
- データの切替：`EXPO_PUBLIC_DATA_MODE=demo | production`（`src/data/config.ts`）。デモは架空施設（`src/data/demo`）、本番は Supabase（`src/data/supabase`）。両方とも `src/data/repository.ts` の `Backend` を実装。
- 判定ロジックは `src/domain`（UI から独立・単体テストあり）。
- 確認結果（このブランチの最新コミット時点）：
  - `npx tsc --noEmit` 通過、`npx eslint src` 通過（警告0）
  - `npx jest` 12 ファイル・158 件通過
  - `npm run test:rls`（ローカル PostgreSQL 16＋Supabase 互換スタブ）全項目通過
  - `npm run test:db`（テンプレート投入 → DB → アプリの読み取り）通過
  - Web プレビュー（`dist-web-preview`）を Playwright で操作し、探す・いますぐ涼みたい・お散歩プラン・詳細・涼しさの地図・マイページの表示を確認（下の「既知の問題」も参照）
- 実機（iOS / Android）では一度も動かしていません。

## 2. 直近で実装したもの（2026-11-12〜14）

ユーザーの依頼：「暑さを軸にする」「うちの子単位で合うかを出す」「1日のタイムライン」「お散歩プラン」「涼しさの地図」「犬が主役の写真」「うちの子カード」。

| 機能 | 主なファイル | 補足 |
| --- | --- | --- |
| 暑さ指数（WBGT） | `src/domain/heat.ts`、`src/ui/Heat.tsx`、`src/ui/useHeat.ts`、`SupabaseHeat`（`src/data/supabase/SupabaseBackend.ts`）、`supabase/functions/heat-index/index.ts` | 環境省の段階（21/25/28/31℃）。端末で最寄りの観測地点を選び、**地点番号だけ**を Edge Function に送る。デモは月と時刻から作る架空値（`demoHeatForecast`） |
| いますぐ涼みたい | `src/app/cool-now.tsx`、`src/domain/cool.ts`（`coolNow`） | 開いている・確認済み・犬の条件が不一致でない場所から最寄り1件＋候補2件 |
| 「うちの子」単位の判定 | `src/domain/judge.ts`（`judgeBreed` `judgeDogCount`）、`src/domain/types.ts`（`DogProfile.breed/brachycephalic/dogCount`、`DogZone.breed/maxDogs/floor/dogMenu/dogSeats`） | 短頭種NG・頭数上限。未確認は「要確認」で、「可」にしない |
| 1日のタイムライン | `src/ui/DayTimeline.tsx`、`src/domain/hours.ts`（`daySegments` `dogDaySegments` `intersectSegments`） | 詳細画面。営業・犬と過ごせる時間・暑さ指数を同じ時間軸に重ねる |
| お散歩プラン | `src/app/walk.tsx`、`src/domain/cool.ts`（`planWalk`） | 徒歩 3km/h・道のり係数 1.3。時間内に戻れる範囲で近い順に休憩先をつなぐ |
| 涼しさの地図 | `src/ui/SearchMap.tsx`（ネイティブ：円）、`src/ui/SearchMap.web.tsx`＋`src/ui/CoolMapDiagram.tsx`（Web：簡易図）、`coverageCircles` `coverageRatio` | 徒歩10分圏を表示し、範囲内の何%をカバーしているかを出す |
| 犬が主役の写真 | `src/app/gallery/[placeId].tsx`、`src/ui/UgcSection.tsx`、`src/ui/DogInfoPicker.tsx`、`src/domain/ugc.ts`（`similarity` `sortBySimilarity`） | 口コミ・写真に「一緒に行った犬のサイズ・犬種」（任意・公開）。うちの子に近い順に並べ替え |
| うちの子カード | `src/app/dog-card.tsx`、`src/storage/dogProfile.ts`（`sanitizeCard`） | **端末内のみ**。ワクチン接種日が1年以上前なら注意表示。詳細画面の「入店時に見せる」から開く |
| 施設カテゴリ追加 | ホームセンター・ペットショップ・公共施設 | デモ施設 demo-27〜29 |

DB 側（`supabase/migrations/20261114000000_dog_first.sql`）：
- `place_category` に3値を追加。
- `place_dog_zones` に犬種・頭数・床・犬用メニュー・席数の列を追加。
- `place_reviews` と `place_photos` に `dog_size` と `dog_breed` を追加（列単位で公開）。
- `submit_place_review_v2` / `begin_photo_upload_v2` を追加。
- `wbgt_points`（公開の地点一覧）と `private.wbgt_cache`（service_role 専用の関数経由）を追加。

アプリは新しい列や関数が無い DB でも動きます。`withLegacy` が、Postgres のエラー 42703 と PostgREST の PGRST202 / PGRST204 を受けたときに旧形式で再試行します。

## 3. 本番 Supabase の状態（2026-11-12 確認）

- プロジェクト ref：`nkquqkgywcjzafdpjxhf`。
- 適用済み：init、ugc_media_nationwide 相当、step3（seed：東京3エリア・14駅、店舗0件）、Edge Function `delete-account`（verify_jwt=false）。
- **未適用**：
  - `20261113000000_ugc_blocks.sql`（ブロック）。SQL Editor 用は `/mnt/project-files/wanpo/supabase-step4-blocks.sql`。
  - `20261114000000_dog_first.sql`。SQL Editor 用は `/mnt/project-files/wanpo/supabase-step5-dog-first.sql`。
  - どちらもユーザーが SQL Editor で実行する予定で、順番は step4 → step5。
- Edge Function `heat-index` は未デプロイで、`WBGT_BASE_URL` も未設定です。環境省の利用条件を確認してから設定します（release-checklist の「B」）。
- 秘密鍵（secret / service_role）は Edge Function の環境にだけ置きます。アプリ・`EXPO_PUBLIC_*`・リポジトリには入れません。

## 4. 残りの作業（Codex 向け・優先順）

### 4-1. すぐ直したい既知の問題

1. **お散歩プランが初期状態で空になる**
   - 再現：デモの初期基準点「東京都心（港区周辺）」、いまから・60分。結果は「この時間・距離で立ち寄れる涼める場所が見つかりません」になる。
   - 原因：最寄りのデモ施設が約1.4km（片道約36分）で、往復と休憩が60分に収まらない。
   - 案：見つからないときに「最寄りは片道◯分。90分なら立ち寄れます」と提案する、または時間を1段階延ばしたプランを自動で並べて出す。
   - 関係ファイル：`planWalk` の `warnings`、`src/app/walk.tsx`。
2. **「いますぐ涼みたい」が遠い場所を大きく出す**
   - 現状は 3km 以内の最寄りを出すので、徒歩36分の場所が「いちばん近い」として大きく表示される。
   - 案：徒歩20分を超える場合は「近くに涼める場所がありません」を主にし、遠い候補は控えめに出す。暑さが「厳重警戒」以上なら移動を勧めない文言にする。
3. **Web プレビューでのギャラリー遷移が未確認**
   - Playwright で一覧の先頭施設の詳細から「犬の写真をすべて見る」を押せなかった。先頭施設に写真が無い可能性がある。
   - 写真のあるデモ施設（demo-01, 04, 07, 27, 28）で `/gallery/[placeId]` が開くか確認する。`/dog-card` も同様に確認する。
4. Edge Function の CSV パーサーは `src/domain/heat.ts` の `parseWbgtForecastCsv` の複製です（Deno から import できないため）。
   - 片方を直したらもう片方も直す。
   - できれば共通化するか、同じ入力で同じ結果になるテストを追加する。

### 4-2. 実データ・外部設定が必要なもの（ユーザーの了承が前提）

- 暑さ指数の設定：
  1. 環境省の利用条件を確認する。
  2. 地点一覧 CSV を `npm run import:wbgt -- --master <CSV> --sql out/wbgt-points.sql` で SQL にして実行する。
  3. `npx supabase functions deploy heat-index --no-verify-jwt` でデプロイする。
  4. `WBGT_BASE_URL` を設定する。
  - 予測 CSV の実ファイル形式は公開資料から実装しただけで、実物では未確認です（このサンドボックスからは env.go.jp に接続できなかった）。
  - 提供期間は例年4月下旬〜10月下旬です。期間外は `off_season` を返します。
- 実在店舗の登録：`npm run import:places`。`templates/places.template.*` に新しい列（`zone_breed_restriction` など）を追加済み。
- 店舗情報・写真を他サービスから収集しないこと。未確認の店舗を自動生成しないこと。

### 4-3. リリースまで（`docs/release-checklist.md` を正とする）

- ユーザーが決めること：
  - アプリID、運営者名、問い合わせメール。
  - 24時間対応の文言。
  - 独自 SMTP。
  - Magic Link テンプレートへの `{{ .Token }}` の追加。
  - Apple / Google の開発者登録（有料）。
- 実機確認：`docs/status.md` の「未検証」表のすべて。特に次のもの。
  - 位置情報ダイアログ
  - ネイティブ地図の涼しさの円
  - 写真の EXIF 除去
  - OTP
  - Storage

## 5. 守ってほしいルール（過去のユーザー指示・設計方針）

- **位置情報**：
  - 取得は利用者がボタンを押したときだけにする。バックグラウンドでは取得しない。
  - 移動履歴を残さない。位置をサーバーに保存しない。
  - 暑さ指数も地点番号だけを送る。
- **ログ**：認証トークン・メールアドレス・正確な位置をログに出さない。
- **非公開情報**（内部メモ、報告者・投稿者のID）を公開レスポンスに含めない。列単位の `grant select` と RLS で守っている。新しい列は必ず `supabase/tests/*.test.sql` で確認する。
- 本番でエラーが起きても、**自動でデモに切り替えない**。
- デモでは電話・公式サイト・予約・経路のボタンを無効のままにする。
- **画像**：実在の店舗や犬の写真に見える生成画像は使わない。デモの犬は「デモのイラスト」と明記した幾何学的なイラスト（`assets/source/make-demo-dogs.mjs`）。
- **判定**：投稿（口コミ・写真）は施設の判定に使わない。未確認は「可」にせず「不明／要確認」にする。
- **Windows**：ユーザーの PC は Windows。npm scripts に POSIX 形式の環境変数（`FOO=bar cmd`）を書かない。
- **lint**：ESLint の `react-hooks/set-state-in-effect` が有効。effect 内で setState せず、「key を持つ state」の形にする（`src/ui/useNearbyResults.ts` `src/ui/useHeat.ts` を参照）。
- **文言**：UI とドキュメントは日本語。
- 有料契約や、店舗を公開すること自体は、ユーザーの判断なしに行わない。

## 6. コマンド

```bash
npm install
npx expo start                    # 開発サーバー（.env が無ければデモ）
npx tsc --noEmit && npx eslint src && npx jest
# DB テスト（ローカル PostgreSQL 16 が必要。パスワード postgres の例）
sudo service postgresql start
PGPASSWORD=postgres npm run test:rls
PGPASSWORD=postgres npm run test:db
# Web プレビューの単一 HTML（dist-web-preview/index.html）
EXPO_OFFLINE=1 node scripts/build-web-preview.mjs
# アイコン・デモの犬イラストの再生成（playwright が必要）
node assets/source/make-icons.mjs
node assets/source/make-demo-dogs.mjs
```

- `npx expo prebuild` は package.json の scripts を書き換えて `android/` を作るので、実行したら元に戻すこと。`ios/` と `android/` はコミットしない。
- DB を変えるときは `supabase/migrations/` に新しいファイルを追加し、`supabase/tests/` にテストを足し、`npm run test:rls` を通す。本番への適用は SQL Editor 用のファイルにして、ユーザーに実行してもらう運用にしている。

## 7. 主なディレクトリ

```
src/app/            画面（Expo Router）。(tabs)/index=探す, saved=保存, profile=マイページ
src/domain/         判定・時間・暑さ・散歩・投稿の並べ替え（純粋関数・テストあり）
src/data/           Backend（demo / supabase）、import（CSV/JSON 検証・SQL 生成）
src/storage/        端末内保存（保存一覧・犬プロフィール・うちの子カード）
src/ui/             共通部品・テーマ（theme.ts）
supabase/           migrations, functions（delete-account, heat-index）, tests
scripts/            投入・テスト・プレビュー作成
docs/               状況・チェックリスト・ストア文面・規約・プライバシー
templates/          店舗・エリア・駅の投入テンプレート
```
