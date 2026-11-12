# リリースまでのチェックリスト

アプリ側の実装・デザイン・ストア審査向けの機能（利用規約の同意、通報、ブロック、アプリ内アカウント削除）はそろっています。
残りは **運営者が決めること・契約が必要なこと・実機での確認** です。上から順に進めてください。

## A. 運営者が決めること（ストア申請の前提）

- [ ] **アプリID**：iOS の Bundle ID と Android のパッケージ名（例 `jp.<運営者名>.inutosuzumeru`）。一度公開すると変えられません。
      → EAS の環境変数 `IOS_BUNDLE_IDENTIFIER` / `ANDROID_PACKAGE` に設定（`app.config.ts` が読みます）
- [ ] **運営者名・お問い合わせメール**：`EXPO_PUBLIC_OPERATOR_NAME` / `EXPO_PUBLIC_SUPPORT_EMAIL`（アプリの規約・プライバシー画面に表示）
- [ ] **通報への対応時間**：規約に「原則24時間以内に確認を始める」と書いています。体制に合わせて `src/app/terms.tsx` と `docs/terms-of-service.md` を直してください
- [ ] **公開ページ**：プライバシーポリシー・利用規約・サポート（問い合わせ先）・アカウント削除の案内を、だれでも見られるURLで公開（`docs/` の各ファイルが原稿）
- [ ] 規約・プライバシーポリシーの法的な確認（専門家）

## B. Supabase（本番）

- [ ] **手順4のSQL**（`supabase-step4-blocks.sql`）を SQL Editor で実行 … 投稿者のブロック機能。未実行だとブロックがエラーになります
- [ ] **手順5のSQL**（`supabase-step5-dog-first.sql`）を手順4の後に実行 … 犬種・頭数などの施設情報、投稿した犬のサイズ・犬種、暑さ指数の地点。未実行でもアプリは旧形式で動きますが、これらは表示されません
- [ ] **暑さ指数**：環境省「熱中症予防情報サイト」の利用条件（アプリでの表示・商用利用）を環境省に確認 → 了承後に ① 地点一覧CSVを `npm run import:wbgt -- --master <CSV> --sql out/wbgt-points.sql` で SQL にして実行 ② `npx supabase functions deploy heat-index --no-verify-jwt` ③ `npx supabase secrets set WBGT_BASE_URL=<予測CSVの置き場所のURL>`。設定するまでアプリは「暑さ指数は準備中」と表示します。提供期間は例年4月下旬〜10月下旬で、期間外は「提供期間外」と表示されます
- [ ] **Magic Link のメール文面**に確認コード `{{ .Token }}` を追加（Authentication → Emails → Templates）
- [ ] **独自のSMTP** を設定（Authentication → Emails → SMTP Settings）。Supabase 標準のメール送信は、プロジェクトのメンバー宛てにしか届かず送信数も少ないため、一般の利用者と審査担当者がログインできません
- [ ] Authentication → Rate Limits でメール送信の上限を確認
- [ ] Advisors（Security / Performance）に警告がないことを確認

## C. 掲載データ

- [ ] **実在店舗を運営が確認して登録**（`docs/operations.md`）。0件のままだと、審査で「機能が足りない」として却下される可能性が高いです。最初は1地域に絞って十分な件数をそろえるのがおすすめです
- [ ] 店舗写真を載せる場合は、権利を確認したものだけを `place_media` に登録

## D. 開発者アカウント（有料・運営者が契約）

- [ ] Apple Developer Program（年額）
- [ ] Google Play Console（登録料）。**個人アカウントは、製品版の公開前に「クローズドテスト（12人以上・14日間）」が必要**です
- [ ] Expo アカウント（EAS Build 用、無料枠あり）

## E. ビルドと実機確認

```bash
npx eas-cli@latest login
npx eas-cli@latest init                    # プロジェクトIDを app.config に登録
npx eas-cli@latest env:create              # EXPO_PUBLIC_SUPABASE_URL など .env の3行＋運営者名・メール・アプリID・地図キー
npx eas-cli@latest build --profile preview --platform all   # 社内配布版で実機確認
```

- [ ] `docs/status.md`「未検証」の項目を実機で確認（位置情報の許可・拒否、地図、電話・経路、写真選択、オフライン、読み上げ）
- [ ] 起動画面（緑の背景に白いアーチと犬）とアイコンが正しく出ること
- [ ] 本番データで、口コミ投稿 → 別アカウントで通報・ブロック → 表示されなくなる → 解除、の一連を確認
- [ ] アカウント削除後に、同じメールで再登録できること

## F. ストア申請

```bash
npx eas-cli@latest build --profile production --platform all
npx eas-cli@latest submit --profile production --platform ios       # 初回は App Store Connect でアプリを作成してから
npx eas-cli@latest submit --profile production --platform android   # 内部テスト用トラックに下書きで上がります
```

- [ ] 掲載文・キーワード・プライバシー項目・審査メモ：`docs/store-listing.md`
- [ ] スクリーンショット（実在店舗のデータで撮影）、Android のフィーチャーグラフィック：`assets/store/feature-graphic.png`
- [ ] 年齢区分の質問票（ユーザー生成コンテンツあり）

## 画像の作り直し

アイコン・起動画面・フィーチャーグラフィックは、写真や他社素材を使わず図形だけで作ったオリジナルです。

```bash
node assets/source/make-icons.mjs            # icon / android-icon-* / splash-icon / favicon
node assets/source/make-feature-graphic.mjs  # assets/store/feature-graphic.png
```
