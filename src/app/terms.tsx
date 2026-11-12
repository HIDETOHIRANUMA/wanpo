import React from 'react';
import { ScrollView, Text } from 'react-native';
import { Section } from '@/ui/components';
import { Li, OperatorCard, P } from '@/ui/LegalText';
import { colors, space, type } from '@/ui/theme';

/** 利用規約・投稿ガイドライン（docs/terms-of-service.md と同じ内容） */
export default function TermsScreen() {
  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: space.lg, paddingBottom: 48 }}>
      <Text style={type.small}>このアプリ「犬と涼める」を使う前にお読みください。投稿（口コミ・犬の写真・情報の報告）をすると、この規約とガイドラインに同意したものとみなします。</Text>
      <OperatorCard />

      <Section title="掲載情報について" icon="information-circle-outline">
        <P>掲載している室内同伴・冷房・犬の条件・営業時間などは、運営が確認した日時点の情報です。当日の入店・冷房の稼働・空席・安全を保証するものではありません。お出かけ前に、お店へ電話や公式サイトでご確認ください。</P>
        <P>犬の体調管理は飼い主の責任で行ってください。暑い日の移動や長時間の外出には十分ご注意ください。</P>
      </Section>

      <Section title="投稿ガイドライン" icon="chatbubbles-outline">
        <P>口コミ・写真は、ほかの飼い主さんの参考になる、実際の体験にもとづく内容をお願いします。次の内容は投稿できません。</P>
        <Li>人の顔・名前・連絡先・車のナンバーなど、個人が特定できる情報</Li>
        <Li>他人やお店への誹謗中傷、差別的・暴力的・性的な表現</Li>
        <Li>宣伝・勧誘・スパム、事実と異なる内容、なりすまし</Li>
        <Li>他人が撮影した写真など、あなたに権利のない画像や文章</Li>
        <Li>犬や動物への虐待を連想させる内容、違法な行為を助長する内容</Li>
      </Section>

      <Section title="不適切な投稿への対応" icon="shield-checkmark-outline">
        <P>不適切な投稿は、各投稿の「…」から通報できます。複数の利用者から通報された投稿は自動で非表示になり、運営が内容を確認します。運営はガイドラインに反する投稿を予告なく非表示・削除し、繰り返し違反する利用者の投稿を制限することがあります。</P>
        <P>気になる投稿者は「ブロック」すると、その人の口コミ・写真があなたに表示されなくなります。ブロックは相手に知らされず、「マイページ」→「アカウント」からいつでも解除できます。</P>
        <P>通報には、原則として24時間以内に運営が確認を始めます。</P>
      </Section>

      <Section title="投稿の扱い" icon="document-text-outline">
        <P>投稿の著作権は投稿者にあります。投稿者は、運営がこのアプリと関連する案内の中で投稿を表示・縮小・トリミングして利用することを許諾するものとします。自分の投稿はいつでも削除できます。</P>
        <P>投稿は施設の判定（室内同伴・冷房・犬の条件）には使いません。判定は運営の確認情報だけで行います。</P>
      </Section>

      <Section title="禁止事項" icon="ban-outline">
        <Li>アプリやサーバーへの不正なアクセス、過度な負荷をかける行為</Li>
        <Li>掲載情報や投稿を、許可なく大量に複製・再配布する行為</Li>
        <Li>法令や公序良俗に反する行為</Li>
      </Section>

      <Section title="免責・変更" icon="alert-circle-outline">
        <P>運営は、掲載情報や投稿の正確性、アプリを利用したことで生じた損害について、運営の故意または重大な過失による場合を除き責任を負いません。この規約は必要に応じて変更し、アプリ内でお知らせします。</P>
      </Section>
    </ScrollView>
  );
}
