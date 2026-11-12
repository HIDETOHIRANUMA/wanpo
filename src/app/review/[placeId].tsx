import * as Crypto from 'expo-crypto';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { RepoError } from '@/data/repository';
import { toJst } from '@/domain/hours';
import type { Place } from '@/domain/types';
import {
  NICKNAME_MAX,
  REVIEW_BODY_MAX,
  REVIEW_TAG_LABEL,
  REVIEW_TAGS,
  validateReview,
  type UgcSubmitResult,
} from '@/domain/ugc';
import { useApp } from '@/state/AppContext';
import type { ReviewDraft } from '@/storage/ugcDrafts';
import { Button, Card, Chip, DemoBanner, ErrorState, Loading, Section } from '@/ui/components';
import { errorMessage } from '@/ui/errors';
import { OtpLogin } from '@/ui/OtpLogin';
import { colors, MIN_TAP, radius, space, type } from '@/ui/theme';

export default function ReviewComposeScreen() {
  const params = useLocalSearchParams<{ placeId: string }>();
  const placeId = String(params.placeId);
  const { backend, reviewDrafts, auth, isDemo } = useApp();
  const [place, setPlace] = useState<Place | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<RepoError | null>(null);
  const [draft, setDraft] = useState<ReviewDraft | null>(null);
  const [phase, setPhase] = useState<'form' | 'auth' | 'done'>('form');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [result, setResult] = useState<UgcSubmitResult | null>(null);
  const loaded = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        setPlace(await backend.places.getPlace(placeId));
      } catch (e) {
        setLoadError(e instanceof RepoError ? e : new RepoError('network'));
      }
      const saved = await reviewDrafts.load(placeId);
      const nickname = await reviewDrafts.lastNickname();
      setDraft(
        saved ?? {
          requestId: Crypto.randomUUID(),
          placeId,
          nickname,
          body: '',
          tags: [],
          visitedOn: null,
          updatedAt: new Date().toISOString(),
        },
      );
      loaded.current = true;
    })();
  }, [backend, reviewDrafts, placeId]);

  useEffect(() => {
    if (draft && loaded.current && phase !== 'done') reviewDrafts.save({ ...draft, updatedAt: new Date().toISOString() }).catch(() => undefined);
  }, [draft, reviewDrafts, phase]);

  if (loadError) return <ErrorState message={errorMessage(loadError, '施設情報を読み込めませんでした。')} />;
  if (place === undefined || !draft) return <Loading />;
  if (place === null) return <ErrorState message="現在の掲載情報を確認できないため、口コミを書けません。" />;

  const today = toJst(new Date()).date;
  const errors = validateReview(draft, today);
  const update = (patch: Partial<ReviewDraft>) => {
    setSendError(null);
    setDraft({ ...draft, ...patch });
  };

  const submit = async () => {
    if (errors.length) return;
    if (!auth.signedIn) {
      setPhase('auth');
      return;
    }
    setSending(true);
    setSendError(null);
    try {
      const r = await backend.ugc.submitReview(draft);
      await reviewDrafts.clear(placeId);
      await reviewDrafts.rememberNickname(draft.nickname.trim());
      setResult(r);
      setPhase('done');
    } catch (e) {
      if (e instanceof RepoError && e.kind === 'auth_required') setPhase('auth');
      setSendError(errorMessage(e, '投稿できませんでした。入力内容は保持しています。'));
    } finally {
      setSending(false);
    }
  };

  if (phase === 'done' && result) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: space.lg, gap: space.md }}>
        <Stack.Screen options={{ title: '口コミを書く' }} />
        {isDemo ? <DemoBanner /> : null}
        <Card style={{ gap: space.sm }}>
          <Text style={type.heading}>
            {result.storedAt === 'demo_local' ? 'この端末にデモとして保存しました' : result.status === 'approved' ? '口コミを公開しました' : '口コミを受け付けました'}
          </Text>
          <Text style={type.body}>
            {result.storedAt === 'demo_local'
              ? 'デモのため送信はしていません。この端末の施設ページにだけ表示されます。'
              : result.status === 'approved'
                ? '施設ページに表示されます。不適切な内容は通報により非表示になることがあります。自分の口コミはいつでも削除できます。'
                : '運営の確認後に公開されます。'}
          </Text>
        </Card>
        <Button label="施設の詳細に戻る" onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: space.lg, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: '口コミを書く' }} />
      {isDemo ? <DemoBanner /> : null}
      <Text style={type.heading}>{place.name}</Text>
      <Text style={type.small}>
        口コミはニックネームで公開されます。メールアドレスは公開されません。犬同伴の可否や冷房の判定は運営の確認情報で行い、口コミでは変わりません。
      </Text>

      <Section title="ニックネーム">
        <TextInput
          value={draft.nickname}
          onChangeText={(t) => update({ nickname: t })}
          maxLength={NICKNAME_MAX}
          placeholder="例：むぎママ"
          placeholderTextColor={colors.textMuted}
          style={inputStyle}
          accessibilityLabel="ニックネーム"
        />
        <Text style={type.small}>本名やSNSのIDは避けてください（{NICKNAME_MAX}文字まで）</Text>
      </Section>

      <Section title="よかった点・気になった点（複数選択可）">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {REVIEW_TAGS.map((t) => (
            <Chip
              key={t}
              label={REVIEW_TAG_LABEL[t]}
              selected={draft.tags.includes(t)}
              onPress={() => update({ tags: draft.tags.includes(t) ? draft.tags.filter((x) => x !== t) : [...draft.tags, t] })}
            />
          ))}
        </View>
      </Section>

      <Section title="口コミ">
        <TextInput
          value={draft.body}
          onChangeText={(t) => update({ body: t })}
          multiline
          maxLength={REVIEW_BODY_MAX}
          placeholder="例：お昼すぎでも店内が涼しく、犬用の水も出してもらえました"
          placeholderTextColor={colors.textMuted}
          style={[inputStyle, { minHeight: 140, textAlignVertical: 'top', paddingTop: space.sm }]}
          accessibilityLabel="口コミ本文"
        />
        <Text style={type.small}>
          {draft.body.length}/{REVIEW_BODY_MAX}文字。店員さんや他のお客さんの名前・写真、電話番号などの個人情報は書かないでください。
        </Text>
      </Section>

      <Section title="訪問日（任意）">
        <TextInput
          value={draft.visitedOn ?? ''}
          onChangeText={(t) => update({ visitedOn: t.trim() === '' ? null : t.trim().replace(/\//g, '-') })}
          placeholder={`例：${today}`}
          placeholderTextColor={colors.textMuted}
          style={inputStyle}
          accessibilityLabel="訪問日（年-月-日）。任意"
        />
        {errors.includes('visitedOn') ? (
          <Text style={{ color: colors.bad }}>訪問日は「{today}」の形式で、2年以内の今日以前の日付を入力してください</Text>
        ) : null}
      </Section>

      {phase === 'auth' && !auth.signedIn ? (
        <Section title="メールで確認">
          <Text style={type.small}>入力内容はこの端末に保持しています。確認が終わると投稿できます。</Text>
          <OtpLogin onSignedIn={() => setPhase('form')} />
        </Section>
      ) : null}

      <Button
        label={auth.signedIn ? (isDemo ? 'デモとして端末に保存' : '投稿する') : 'メールで確認して投稿'}
        onPress={submit}
        loading={sending}
        disabled={errors.length > 0}
        disabledReason={errors.length > 0 ? 'ニックネームと口コミを入力してください' : undefined}
        style={{ marginTop: space.xl }}
      />
      <Text style={[type.small, { marginTop: space.sm }]}>
        投稿は1日5件までです。投稿の扱いは「プライバシーポリシー」に記載しています。
      </Text>
      {sendError ? (
        <View style={{ marginTop: space.md, gap: space.sm }}>
          <Text style={{ color: colors.bad }} accessibilityLiveRegion="assertive">
            {sendError}
          </Text>
          {auth.signedIn ? <Button label="再試行" variant="secondary" onPress={submit} loading={sending} /> : null}
        </View>
      ) : null}
    </ScrollView>
  );
}

const inputStyle = {
  minHeight: MIN_TAP,
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: radius.md,
  paddingHorizontal: space.md,
  fontSize: 16,
  color: colors.text,
  backgroundColor: colors.surface,
};
