import React from 'react';
import { ScrollView, Text } from 'react-native';
import { Section } from '@/ui/components';
import { colors, space, type } from '@/ui/theme';

/** docs/privacy-policy.md と同じ内容の要約。運営者名・連絡先・公開URLは未設定 */
function P({ children }: { children: React.ReactNode }) {
  return <Text style={type.body}>{children}</Text>;
}

export default function PrivacyScreen() {
  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: space.lg, paddingBottom: 48 }}>
      <Text style={type.small}>運営者名・お問い合わせ先・公開URL：未設定（公開前に記載します）</Text>
      <Section title="位置情報">
        <P>「現在地から探す」を押したときだけ、1回だけ現在地を取得します。距離の計算は端末内で行い、現在地を保存・送信しません。バックグラウンドでの取得や移動の記録は行いません。</P>
      </Section>
      <Section title="端末に保存する情報">
        <P>保存した施設、犬の条件（名前・体重・同伴方法・証明書）、報告の下書きは、この端末にだけ保存します。「犬の条件」タブの「この端末のデータを削除」で削除できます。</P>
      </Section>
      <Section title="地図・外部サービス">
        <P>地図の表示では、iPhone は Apple のマップ、Android は Google のマップを使います。表示している範囲の地図データを取得するため、地図の範囲や端末の情報がそれぞれの提供者に送られます。このアプリが現在地を地図提供者へ渡すことはありません（地図上の現在地表示は使っていません）。</P>
        <P>「経路を見る」では、施設の座標だけを端末の地図アプリ（Apple マップまたは Google マップ）に渡します。電話・公式サイトは端末の電話アプリ・ブラウザで開きます。</P>
      </Section>
      <Section title="ログインと報告">
        <P>情報の修正を知らせる、犬と過ごせたかを回答する、口コミ・写真を投稿する、投稿を通報するときだけ、メールアドレスで確認（ワンタイムコード）します。メールアドレスは認証のために認証サービスに保存されます。</P>
        <P>報告・回答の内容、施設、訪問日（任意）、受付日時を保存し、運営が掲載内容の確認に使います。公開はしません。投稿の回数制限のため、1日の送信回数を記録します。</P>
      </Section>
      <Section title="口コミ・犬の写真">
        <P>口コミと写真は投稿するとすぐ施設ページで公開されます。公開されるのはニックネーム・本文・タグ・訪問日・写真・ひとことで、メールアドレスは公開しません。</P>
        <P>写真は端末で縮小して作り直してから送ります。撮影場所などの位置情報は読み込まず、送信もしません。人の顔などが写らないようにしてください。</P>
        <P>通報が複数集まった投稿は自動で非表示になり、運営が確認します。通報した人が投稿者に知らされることはありません。自分の口コミ・写真はいつでも削除できます。</P>
      </Section>
      <Section title="予約ページ">
        <P>「予約ページを開く」は、店舗または予約サービスのページを端末のブラウザで開きます。予約内容はこのアプリには届きません。</P>
      </Section>
      <Section title="アカウントの削除">
        <P>「アカウント」画面から削除できます。サーバーで本人を確認したうえで、アカウントとあなたの報告・回答・口コミ・写真・通報の記録を削除します。運営がすでに確認して掲載情報を更新した内容（施設の情報そのもの）は残ります。</P>
      </Section>
      <Section title="記録しない情報">
        <P>アプリのログに、ログイン用の情報、メールアドレス、正確な位置情報を記録しません。</P>
      </Section>
      <Section title="表示内容について">
        <P>掲載情報は確認日時点のものです。当日の入店・冷房の稼働・空席を保証するものではありません。お出かけ前に電話や公式サイトでご確認ください。</P>
      </Section>
    </ScrollView>
  );
}
