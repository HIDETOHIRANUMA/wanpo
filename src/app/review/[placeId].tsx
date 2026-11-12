import * as Crypto from 'expo-crypto';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
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
import { Button, Chip, DemoBanner, EmptyState, ErrorState, Loading, Notice, Section, TextField } from '@/ui/components';
import { TermsConsent } from '@/ui/TermsConsent';
import { errorMessage } from '@/ui/errors';
import { OtpLogin } from '@/ui/OtpLogin';
import { colors, space, type } from '@/ui/theme';

export default function ReviewComposeScreen() {
  const params = useLocalSearchParams<{ placeId: string }>();
  const placeId = String(params.placeId);
  const { backend, reviewDrafts, auth, isDemo, termsAccepted, acceptTerms } = useApp();
  const [termsChecked, setTermsChecked] = useState(false);
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

  const termsOk = termsAccepted || termsChecked;
  const submit = async () => {
    if (errors.length || !termsOk) return;
    if (!termsAccepted) await acceptTerms();
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
        <EmptyState
          icon="checkmark-circle"
          title={result.storedAt === 'demo_local' ? 'この端末にデモとして保存しました' : result.status === 'approved' ? '口コミを公開しました' : '口コミを受け付けました'}
          body={
            result.storedAt === 'demo_local'
              ? 'デモのため送信はしていません。この端末の施設ページにだけ表示されます。'
              : result.status === 'approved'
                ? '施設ページに表示されます。不適切な内容は通報により非表示になることがあります。自分の口コミはいつでも削除できます。'
                : '運営の確認後に公開されます。'
          }
        >
          <Button label="施設の詳細に戻る" icon="arrow-back" onPress={() => router.back()} />
        </EmptyState>
      </View>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: space.lg, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: '口コミを書く' }} />
      {isDemo ? <DemoBanner /> : null}
      <Text style={type.title}>{place.name}</Text>
      <Text style={[type.small, { marginTop: 4 }]}>
        口コミはニックネームで公開されます。メールアドレスは公開されません。犬同伴の可否や冷房の判定は運営の確認情報で行い、口コミでは変わりません。
      </Text>

      <Section title="ニックネーム" icon="person-outline">
        <TextField
          value={draft.nickname}
          onChangeText={(t) => update({ nickname: t })}
          maxLength={NICKNAME_MAX}
          placeholder="例：むぎママ"
          accessibilityLabel="ニックネーム"
          helper={`本名やSNSのIDは避けてください（${NICKNAME_MAX}文字まで）`}
        />
      </Section>

      <Section title="よかった点・気になった点" icon="pricetags-outline" subtitle="複数選択できます">
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

      <Section title="口コミ" icon="create-outline">
        <TextField
          value={draft.body}
          onChangeText={(t) => update({ body: t })}
          multiline
          maxLength={REVIEW_BODY_MAX}
          placeholder="例：お昼すぎでも店内が涼しく、犬用の水も出してもらえました"
          accessibilityLabel="口コミ本文"
          helper={`${draft.body.length}/${REVIEW_BODY_MAX}文字。店員さんや他のお客さんの名前・写真、電話番号などの個人情報は書かないでください。`}
        />
      </Section>

      <Section title="訪問日（任意）" icon="calendar-outline">
        <TextField
          value={draft.visitedOn ?? ''}
          onChangeText={(t) => update({ visitedOn: t.trim() === '' ? null : t.trim().replace(/\//g, '-') })}
          placeholder={`例：${today}`}
          accessibilityLabel="訪問日（年-月-日）。任意"
          error={errors.includes('visitedOn') ? `訪問日は「${today}」の形式で、2年以内の今日以前の日付を入力してください` : null}
        />
      </Section>

      <Section title="利用規約" icon="document-text-outline">
        <TermsConsent value={termsChecked} onChange={setTermsChecked} alreadyAccepted={termsAccepted} />
      </Section>

      {phase === 'auth' && !auth.signedIn ? (
        <Section title="メールで確認" icon="mail-outline">
          <Text style={type.small}>入力内容はこの端末に保持しています。確認が終わると投稿できます。</Text>
          <OtpLogin onSignedIn={() => setPhase('form')} />
        </Section>
      ) : null}

      <Button
        label={auth.signedIn ? (isDemo ? 'デモとして端末に保存' : '投稿する') : 'メールで確認して投稿'}
        icon="send-outline"
        size="lg"
        onPress={submit}
        loading={sending}
        disabled={errors.length > 0 || !termsOk}
        disabledReason={errors.length > 0 ? 'ニックネームと口コミを入力してください' : !termsOk ? '利用規約・投稿ガイドラインへの同意が必要です' : undefined}
        style={{ marginTop: space.xl }}
      />
      <Text style={[type.caption, { marginTop: space.sm }]}>
        投稿は1日5件までです。投稿の扱いは「プライバシーポリシー」に記載しています。
      </Text>
      {sendError ? (
        <View style={{ marginTop: space.md, gap: space.sm }}>
          <Notice tone="bad" title={sendError} />
          {auth.signedIn ? <Button label="再試行" icon="refresh" variant="secondary" onPress={submit} loading={sending} /> : null}
        </View>
      ) : null}
    </ScrollView>
  );
}
