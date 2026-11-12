# 犬と涼める（MVP）

冷房のある室内で、自分の犬の条件に合う休憩先を、出かける前に探すための iOS / Android アプリです。
判定の対象は施設全体ではなく **「犬が滞在できる区画」**。同じ区画で「犬の室内同伴」と「冷房」の両方に確認記録がある施設を、主な検索結果にします。

- 体験の流れ：検索 → 写真・雰囲気・口コミ・犬の条件・確認日を見る → 電話／公式サイト／予約ページで確認 → 外部地図で向かう → 保存
- 対象エリア：**全国**（都道府県 → 市区町村、または駅名で基準点を選ぶ。エリア・駅は `npm run import:geo` で投入）。デモは東京3区・大阪・福岡・札幌の架空施設
- 利用者の投稿：**口コミ**と**犬の写真**（すぐ公開・通報3件で自動非表示・設定で事前確認制に切替可）。投稿は施設の判定（室内同伴・冷房・犬の条件）を変えません
- 「うちの子」と暑さが軸：**暑さ指数（環境省 WBGT 予測）**、**いますぐ涼みたい**（徒歩で行ける開いている1件）、**お散歩プラン**（涼める場所をつなぐ）、**涼しさの地図**（徒歩10分圏）、**詳細の1日のタイムライン**、**犬種（短頭種）・頭数の照合**、**うちの子に近い順の口コミ・写真ギャラリー**、**うちの子カード**（端末内のみ）
- ログイン不要：検索・詳細・口コミと写真の閲覧・保存・犬の条件。**報告・回答・口コミ・写真の投稿・通報** はメールOTP認証

> 実装済み／未検証／実データが必要な項目の一覧は [docs/status.md](docs/status.md) にあります。
> **リリースまでの残り作業**は [docs/release-checklist.md](docs/release-checklist.md)、ストア掲載文は [docs/store-listing.md](docs/store-listing.md)、利用規約は [docs/terms-of-service.md](docs/terms-of-service.md) にあります。

---

## 1. 技術構成（実装時点で `npx expo install` が解決したバージョンをロック）

| 用途 | 採用 | バージョン |
| --- | --- | --- |
| アプリ | Expo SDK / React Native / TypeScript | expo 58.0.24 / react-native 0.88.1 / typescript 6.0 |
| 画面遷移 | Expo Router（`src/app/`） | 58.0.31 |
| 地図 | react-native-maps（iOS: Apple Maps、Android: Google Maps） | 1.29.11 |
| 位置情報 | expo-location（利用時のみ・1回取得） | 58.0.21 |
| 端末保存 | @react-native-async-storage/async-storage | 2.2.0 |
| バックエンド | Supabase（PostgreSQL・Auth・Edge Function） | @supabase/supabase-js 2.119.0 |
| テスト | Jest（jest-expo プリセット）、PostgreSQL での RLS テスト | jest-expo 58.0.x |

正確なバージョンは `package-lock.json` を正としてください。状態管理・UI ライブラリは追加していません（React Context と React Native 標準部品のみ）。

### ディレクトリ

```
src/
  app/                 画面（Expo Router）。(tabs)/index=探す, saved=保存, profile=犬の条件, review/=口コミ投稿, photo/=犬の写真投稿
  domain/              UIから独立した純粋関数：判定（judge）・営業時間（hours）・検索（search）・確認日（verification）・投稿（ugc）・都道府県
  data/
    repository.ts      画面から見たデータ取得の共通インターフェース
    demo/              DemoRepository（架空データ・模擬ログイン・端末内のデモ報告・デモの口コミ/写真）
    supabase/          SupabaseRepository / SupabaseAuth / SupabaseReports / SupabaseUgc（口コミ・写真・通報）
    import/            実データ投入の検証とSQL生成（施設 validate.ts、全国のエリア・駅 geoValidate.ts）
  storage/             端末保存（保存施設・犬の条件・報告/口コミの下書き・前回の基準点）。デモと本番で保存領域を分離
  state/AppContext.tsx モード切替と共有状態
  ui/                  部品・写真つきカード（PlaceVisual）・口コミ/写真欄（UgcSection）・地図・OTPログイン・写真の縮小（imagePrep）
supabase/
  migrations/          スキーマ・RLS・報告受付関数・口コミ/写真/通報・Storage の権限
  functions/delete-account/  アカウント削除（Edge Function）
  seed/areas_stations.sql    エリア・駅（施設データではない）
  tests/               RLS テスト（Supabase互換スタブで素の PostgreSQL 上で実行）
scripts/               投入スクリプト・DBテスト
templates/             実データ投入テンプレート（JSON / CSV）
docs/                  運営手順・プライバシー・利用規約・アカウント削除・ストア掲載文・リリース手順・実装状況
```

---

## 2. インストールと起動（デモ）

前提：Node.js 22 以上（このリポジトリは Node 22.23 / npm 10.9 で確認）。

```bash
npm ci
cp .env.example .env        # Windows (PowerShell): Copy-Item .env.example .env
npx expo start              # 起動。QRコードを Expo Go または開発ビルドで読み込む
```

`.env` の `EXPO_PUBLIC_DATA_MODE=demo` のとき、外部キーなしで一覧・検索・詳細・保存・犬の条件・模擬ログイン・デモ報告が動きます。
画面上部に常に「デモデータ表示中」と表示され、電話・公式サイト・経路案内は無効（理由を表示）です。

- デモの模擬ログイン：コード `123456` で模擬ログイン、`000000` で「期限切れ」表示を確認できます。メールは送信しません。
- デモの報告は「端末内のデモ保存」で、送信済みとは表示しません。

### Expo Go と開発ビルドの違い

| | Expo Go | 開発ビルド（`expo-dev-client`） |
| --- | --- | --- |
| 使える場面 | すぐ試す | 本番に近い確認・ストア提出前 |
| 地図 | react-native-maps は Expo Go に同梱。Android でも Expo 側のキーで表示される | **Android は自分の Google Maps キーが必要**（未設定なら地図の代わりに説明と一覧を表示） |
| 位置情報 | 利用時の取得は可 | 同左（本アプリはバックグラウンド取得を使わない） |
| 設定変更 | `app.config.ts` のネイティブ設定は反映されない | 変更のたびに再ビルドが必要 |

Web プレビュー（`npx expo start --web`）では地図を表示せず説明と一覧のみです。共有用に1ファイルの HTML にまとめる場合は `node scripts/build-web-preview.mjs`（デモモード固定、`dist-web-preview/index.html` に出力）。**Web で動いたことは iOS / Android の動作確認の代わりになりません。**

---

## 3. デモ／本番の切り替えと環境変数

`.env`（Git には含めません。`.gitignore` 済み）

| 変数 | 用途 | アプリに埋め込まれるか |
| --- | --- | --- |
| `EXPO_PUBLIC_DATA_MODE` | `demo` / `production` | はい |
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase の Project URL | はい |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | **publishable key（`sb_publishable_...`）** | はい（公開前提。RLS で保護） |
| `EXPO_PUBLIC_STALE_AFTER_DAYS` | 「再確認をおすすめ」の日数（既定 90。運用上の目安で安全性の基準ではない） | はい |
| `GOOGLE_MAPS_ANDROID_API_KEY` | Android の Maps SDK キー（ビルド時にネイティブ設定へ） | ネイティブ設定に入る（制限必須） |
| `ANDROID_PACKAGE` / `IOS_BUNDLE_IDENTIFIER` | アプリID（既定は `com.example.inutosuzumeru`。公開前に変更） | － |
| `DATABASE_URL` | 投入スクリプト用。**秘密情報。EXPO_PUBLIC_ を付けない** | いいえ |

- **secret key（`sb_secret_...`）や service_role キーは、アプリにも `EXPO_PUBLIC_` 変数にも入れません。** 誤って入れた場合、アプリは起動時に設定エラーとして扱います（`src/data/config.ts`）。
- 本番モードで設定不足・通信障害のときは、エラーと再試行を表示します。**デモへ自動で切り替えません。**
- デモと本番で端末の保存領域（キーの接頭辞）を分けているため、本番結果に架空施設は混ざりません。
- `.env` を変えたら `npx expo start --clear` で再起動してください。

---

## 4. Supabase の準備（本番モード）

1. Supabase でプロジェクトを作成（無料枠で可。有料契約は本作業の範囲外）。
2. スキーマを適用：
   ```bash
   npx supabase login
   npx supabase link --project-ref <プロジェクトref>
   npx supabase db push                       # supabase/migrations を適用
   ```
   CLI を使わない場合は、Studio の **SQL Editor** で `supabase/migrations/` の SQL を**ファイル名の順に**実行（`20261111000000_init.sql` → `20261112000000_ugc_media_nationwide.sql` → `20261113000000_ugc_blocks.sql` → `20261114000000_dog_first.sql`）。2つ目は口コミ・写真・店舗写真・予約URL・全国検索の列と、Storage の非公開バケット `user-photos` とその権限を作ります。
3. エリア・駅を投入：SQL Editor で `supabase/seed/areas_stations.sql` を実行し、全国分は `npm run import:geo`（[docs/operations.md](docs/operations.md) の「7」）。座標は概略値。公開前に確認。
4. API キー：Dashboard → **Project Settings → API Keys** で publishable key を確認し `.env` に設定。
5. アカウント削除関数をデプロイ：
   ```bash
   npx supabase functions deploy delete-account
   ```
   `supabase/config.toml` で `verify_jwt = false` とし、関数内で `auth.getUser(token)` により本人を検証します。関数は Supabase が自動で渡す `SUPABASE_URL` と `SUPABASE_SECRET_KEY`（なければ `SUPABASE_SERVICE_ROLE_KEY`）を使います。
6. 暑さ指数（任意・環境省の利用条件を確認してから）：地点一覧を `npm run import:wbgt -- --master <地点一覧CSV> --sql out/wbgt-points.sql` で SQL にして実行 → `npx supabase functions deploy heat-index --no-verify-jwt` → `npx supabase secrets set WBGT_BASE_URL=<予測CSVの置き場所>`。アプリは位置を送らず、端末で最寄り地点を選んで地点番号だけを送ります。未設定の間は「準備中」と表示します。
7. `.env` を `EXPO_PUBLIC_DATA_MODE=production` にして起動。施設が0件なら「0件」と表示されます（正しい挙動）。

### メールOTPの設定

Supabase の既定のメールテンプレートはマジックリンクです。6桁コードで認証するため次を設定します。

1. Dashboard → **Authentication → Emails → Templates → Magic Link** の本文にコードを入れる：
   ```html
   <p>犬と涼める の確認コード：<strong>{{ .Token }}</strong></p>
   <p>このコードの有効期限は1時間です。心当たりがない場合は破棄してください。</p>
   ```
2. **Authentication → Sign In / Providers → Email**：Email OTP expiration（既定 3600 秒）を確認。
3. **送信元**：Supabase 標準のメール送信は送信数の制限が厳しく、本番運用向けではありません。公開前に **SMTP（独自の送信サービス）** を設定してください（Authentication → Emails → SMTP Settings）。
4. コード再送はアプリ側で60秒の待ち時間を設けています（Supabase 側も既定で同一ユーザーへの送信は60秒に1回）。

アプリは `signInWithOtp({ email, options: { shouldCreateUser: true } })` → `verifyOtp({ email, token, type: 'email' })` を使います。期限切れ・誤りはどちらも「コードが正しくないか、有効期限が切れています」と表示し、再送を案内します。

### セッションの保存と破棄

公式の React Native 手順に合わせ、セッションは AsyncStorage に保存（`persistSession: true`、`autoRefreshToken: true`、`detectSessionInUrl: false`、前面にある間だけ自動更新）。ログアウトは `signOut({ scope: 'local' })` で端末のセッションを破棄します。

---

## 5. 地図の設定

- **iOS**：Apple Maps を使うため API キー不要。
- **Android**：Google Maps SDK for Android のキーが必要（開発ビルド・本番ビルド）。
  1. Google Cloud Console で **Maps SDK for Android** を有効化し、API キーを作成。
  2. キーの制限：**アプリケーションの制限 = Android アプリ**、パッケージ名（`ANDROID_PACKAGE`）と **SHA-1 証明書フィンガープリント** を登録。**API の制限 = Maps SDK for Android のみ**。
     - SHA-1 の取得元：EAS でビルドする場合は `npx eas-cli credentials`（Android → 該当プロファイル）に表示される署名鍵。Google Play で配布する場合は Play Console → **アプリの完全性 → Play アプリ署名** の「アプリ署名鍵の証明書」の SHA-1 も追加する。ローカルで `npx expo run:android` する場合はデバッグ鍵（`android/app/debug.keystore`）の SHA-1。
  3. `.env` の `GOOGLE_MAPS_ANDROID_API_KEY` に設定し、**再ビルド**（キーはネイティブ設定に入るため、JS の再読み込みでは反映されません）。
  4. EAS Build で `.env` を使う場合、`.easignore` は `.env` を除外していません（キーを EAS の環境変数に登録する方法でも可）。
- キー未設定の Android 開発ビルドでは、空白の地図ではなく「地図を表示できません」と一覧への案内を表示します。

---

## 6. iOS / Android の開発ビルド

```bash
npm i -g eas-cli   # または npx eas-cli@latest <command>
npx eas-cli login
npx eas-cli build --profile development --platform android   # APK（内部配布）
npx eas-cli build --profile development --platform ios        # 実機（Apple Developer Program 登録と端末登録が必要）
npx eas-cli build --profile development-simulator --platform ios  # iOS シミュレーター用
npx expo start --dev-client
```

- ローカルでビルドする場合：Android は Android Studio（SDK・エミュレーター）、iOS は macOS + Xcode が必要（`npm run android:dev-build` / `npm run ios:dev-build`）。Windows では iOS のローカルビルドはできないため EAS を使います。
- `ios/` と `android/` は自動生成（Continuous Native Generation）。手で編集せず `app.config.ts` を変更します。
- ストア公開・署名鍵の本番管理・有料契約は今回の範囲外です。

---

## 7. データ投入

```bash
# 検証だけ（エラー行を「[行] 項目: 理由」で表示し、1件でもあれば何も投入しない）
npm run import:places -- templates/places.template.json --check
# Studio の SQL Editor で流す SQL を作る（1トランザクション）
npm run import:places -- data/places.csv --sql out/import.sql
# 直接投入（DATABASE_URL は Dashboard → Connect の接続文字列。秘密情報）
DATABASE_URL='postgresql://...' npm run import:places -- data/places.json --db
```

- 書式：`templates/places.template.json`（推奨）または `templates/places.template.csv`。
- 検証内容：必須値、enum、日本国内の座標、https の URL（公式サイト・予約ページ）、電話番号形式、時間帯（`11:00-14:00`、翌日は `18:00-26:00`）、テラス区画の矛盾、確認記録の根拠（URL か短い説明）、店舗写真の権利・出典、雰囲気タグの数、未登録エリア、デモ名の公開禁止。
- 全国のエリア（市区町村）・駅：`npm run import:geo -- --areas ... --stations ...`（書式は `templates/areas.template.csv` / `templates/stations.template.csv`）。
- 犬の詳細（任意）：`zone.breed_restriction`（none / brachycephalic_ng / text_only）・`breed_text`、`max_dogs_kind`（none / max）・`max_dogs`、`floor_type`（non_slip / slippery / mixed）、`dog_menu`（yes / no）、`dog_seats`。
- 未入力は `unknown` のまま取り込みます（「制限なし」「可」にしません）。`publication_status` の既定は `draft`。
- 確認記録は履歴として追加のみ（同じ記録は重複しません）。

実在店舗の情報は、運営が店舗の公式情報・電話・現地で確認して登録してください。他サービスの店舗情報や写真の無断収集、未確認の店舗の自動生成はしないでください。

---

## 8. 運営の確認手順

[docs/operations.md](docs/operations.md)：Supabase Studio での「登録 → 根拠確認 → 公開 → 報告確認 → 更新」。

---

## 9. テスト

```bash
npm run typecheck     # TypeScript
npm run lint          # ESLint（eslint-config-expo）
npm test              # 判定・営業時間・検索・保存・設定・デモ・投入検証・Supabase層・口コミ/写真（124件）
npm run test:rls      # RLS・権限（匿名／利用者A〜F・Storage・通報・自動非表示）。ローカル PostgreSQL が必要
npm run test:db       # 投入テンプレート → DB → アプリの読み取り・判定の往復
```

- `test:rls` / `test:db` は bash と `psql` が必要です（Windows は Git Bash か WSL）。接続先は `PGHOST` / `PGUSER` / `PGPASSWORD`（既定 localhost / postgres）。Supabase の `anon` / `authenticated` ロールと `auth.uid()` を再現するスタブ（`supabase/tests/00_supabase_stub.sql`）を入れた使い捨てDBで実行します。
- テストの基準時刻は固定（`src/domain/__tests__/fixtures.ts`）。デモデータの確認日・臨時休業日は基準時刻からの相対で作るため、日付が進んでも結果は変わりません。

### 実際の Supabase で RLS を確かめる（未検証・手動）

1. 匿名：publishable key だけで `GET /rest/v1/places?select=id,publication_status` → `published` のみ返ること。`/rest/v1/place_reports` は権限エラー。
2. 利用者A・B をメールOTPでログインし、A のトークンで報告を送信 → B のトークンで `place_reports` を読むと A の報告が見えないこと。
3. A のトークンで `PATCH /rest/v1/places` や `POST /rest/v1/place_verifications` が権限エラーになること。
4. 11回目の送信が `rate_limited` になること（`private.app_settings` の `report_daily_limit` で上限を変更可）。
5. 口コミ：A で `rpc/submit_place_review` → 匿名で `GET /rest/v1/place_reviews?select=*` が**権限エラー**（`author_id` 列が非公開のため）、`select=id,nickname,body` なら読めること。B・C・D の3人で `rpc/flag_ugc` → 匿名で見えなくなること。
6. 写真：A で `rpc/begin_photo_upload` → 返った `storage_path` に Storage API でアップロード → `rpc/complete_photo_upload`。B が同じパスや A のフォルダにアップロードできないこと、匿名で公開前の写真の署名URLを作れないこと。

---

## 10. 既知の制約

- 施設は基準点から選んだ距離の四角い範囲（緯度・経度）でサーバーから取得し、端末で正確な距離・絞り込みを計算します（1回最大500件）。
- 駅検索は登録済みの駅名のみ（住所・地名の検索なし）。駅・エリアの座標は概略値です。
- 写真は非公開の Storage に保存し、期限つきの署名URL（1時間）で表示します。長時間開いたままだと画像が切れるので、画面を開き直すと再取得します。
- 写真の位置情報（EXIF）は読み込まず、縮小・再エンコードした JPEG だけを送ります（再エンコードで EXIF が残らないことは実機で未確認）。
- 「現在利用可能」は登録された営業時間と犬同伴時間による判定で、実際の営業・空席ではありません。
- 犬の条件は1頭分。クラウド同期なし（端末内のみ）。
- 管理画面は作らず Supabase Studio を使います。審査状態の変更・内部メモは Studio（管理者権限）で行います。
- Expo SDK のドキュメントは実装時に参照しましたが、実機・シミュレーター・実際の Supabase では動作確認していません（[docs/status.md](docs/status.md)）。

## 11. 今回の対象外（今後の拡張候補）

アプリ内での予約・決済（予約は外部の予約ページへのリンクのみ）、店舗向け課金、口コミの評価点・いいね、写真の自動の顔検出、チャット、複数頭の複雑な条件、クラウド同期、独自ルート検索、日陰の自動推定、リアルタイム混雑、天気連動通知、バックグラウンド追跡、犬の健康診断・外出安全判定。

## 12. プライバシー・アカウント削除

- プライバシーポリシー雛形：[docs/privacy-policy.md](docs/privacy-policy.md)（運営者名・連絡先・公開URLは **未設定**）
- アカウント削除の案内雛形：[docs/account-deletion.md](docs/account-deletion.md)
