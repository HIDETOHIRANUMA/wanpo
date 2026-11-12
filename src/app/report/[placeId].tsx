import * as Crypto from 'expo-crypto';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { RepoError, REPORT_BODY_MAX, type DogOkVoteChoice, type ReportResult, type ReportTargetField, type ReportType } from '@/data/repository';
import { TARGET_FIELDS, VOTE_CHOICES, validateReportInput } from '@/data/reportValidation';
import type { Place } from '@/domain/types';
import { useApp } from '@/state/AppContext';
import type { ReportDraft } from '@/storage/reportDrafts';
import { Button, Card, Chip, DemoBanner, ErrorState, Loading, Section } from '@/ui/components';
import { errorMessage } from '@/ui/errors';
import { OtpLogin } from '@/ui/OtpLogin';
import { colors, MIN_TAP, radius, space, type } from '@/ui/theme';

const FIELD_LABEL: Record<ReportTargetField, string> = {
  dog_zone: '犬と過ごせる区画',
  indoor_dogs: '室内同伴',
  air_conditioning: '冷房',
  dog_conditions: '犬の条件（体重・同伴方法・証明書）',
  usage_conditions: '注文・予約・料金・利用資格',
  hours: '営業時間・犬同伴可能時間',
  contact: '電話・公式サイト・住所',
  closed: '閉業・休業',
  other: 'その他',
};

const VOTE_LABEL: Record<DogOkVoteChoice, string> = {
  indoor_ok: '室内で犬と過ごせた',
  cart_or_bag_needed: 'カート・バッグ等が必要だった',
  terrace_only: 'テラス席のみだった',
  not_allowed: '犬は入れなかった',
  unsure: 'わからなかった',
};

function emptyDraft(placeId: string, t: ReportType): ReportDraft {
  return {
    requestId: Crypto.randomUUID(),
    placeId,
    type: t,
    targetField: null,
    voteChoice: null,
    body: '',
    visitedOn: null,
    updatedAt: new Date().toISOString(),
  };
}

export default function ReportScreen() {
  const params = useLocalSearchParams<{ placeId: string; type?: string }>();
  const placeId = String(params.placeId);
  const reportType: ReportType = params.type === 'dog_ok_vote' ? 'dog_ok_vote' : 'correction';
  const { backend, drafts, auth, isDemo } = useApp();
  const [place, setPlace] = useState<Place | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<RepoError | null>(null);
  const [draft, setDraft] = useState<ReportDraft | null>(null);
  const [visitedText, setVisitedText] = useState('');
  const [phase, setPhase] = useState<'form' | 'auth' | 'done'>('form');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [result, setResult] = useState<ReportResult | null>(null);
  const loaded = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        setPlace(await backend.places.getPlace(placeId));
      } catch (e) {
        setLoadError(e instanceof RepoError ? e : new RepoError('network'));
      }
      // ログイン前・送信失敗時の入力を復元
      const saved = await drafts.load(placeId, reportType);
      const d = saved ?? emptyDraft(placeId, reportType);
      setDraft(d);
      setVisitedText(d.visitedOn ?? '');
      loaded.current = true;
    })();
  }, [backend, drafts, placeId, reportType]);

  // 入力のたびに端末へ下書き保存
  useEffect(() => {
    if (draft && loaded.current && phase !== 'done') drafts.save({ ...draft, updatedAt: new Date().toISOString() }).catch(() => undefined);
  }, [draft, drafts, phase]);

  if (loadError) return <ErrorState message={errorMessage(loadError, '施設情報を読み込めませんでした。')} />;
  if (place === undefined || !draft) return <Loading />;
  if (place === null) return <ErrorState message="現在の掲載情報を確認できないため、報告できません。" />;

  const update = (patch: Partial<ReportDraft>) => {
    setSendError(null);
    setDraft({ ...draft, ...patch });
  };
  const visitedOn = visitedText.trim() === '' ? null : visitedText.trim().replace(/\//g, '-');
  const input = { ...draft, visitedOn, body: draft.body };
  const errors = validateReportInput(input, new Date());

  const submit = async () => {
    if (errors.length) return;
    if (!auth.signedIn) {
      setPhase('auth');
      return;
    }
    setSending(true);
    setSendError(null);
    try {
      const r = await backend.reports.submit(input);
      // 保存成功後だけ「受け付けました」
      await drafts.clear(placeId, reportType);
      setResult(r);
      setPhase('done');
    } catch (e) {
      // 入力は下書きとして保持したまま。同じ requestId で再試行するので重複しない
      if (e instanceof RepoError && e.kind === 'auth_required') setPhase('auth');
      setSendError(errorMessage(e, '送信できませんでした。入力内容は保持しています。'));
    } finally {
      setSending(false);
    }
  };

  const title = reportType === 'dog_ok_vote' ? '犬と過ごせたかの回答' : '情報の修正を知らせる';

  if (phase === 'done' && result) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: space.lg, gap: space.md }}>
        <Stack.Screen options={{ title }} />
        {isDemo ? <DemoBanner /> : null}
        <Card style={{ gap: space.sm }}>
          {result.storedAt === 'server' ? (
            <>
              <Text style={type.heading}>受け付けました</Text>
              <Text style={type.body}>運営が内容を確認します。確認が終わるまで、掲載情報は変わりません。内容は公開されません。</Text>
            </>
          ) : (
            <>
              <Text style={type.heading}>この端末にデモとして保存しました</Text>
              <Text style={type.body}>デモのため送信はしていません。運営には届きません。</Text>
            </>
          )}
        </Card>
        <Button label="施設の詳細に戻る" onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: space.lg, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title }} />
      {isDemo ? <DemoBanner /> : null}
      <Text style={type.heading}>{place.name}</Text>
      <Text style={type.small}>
        送った内容は運営の確認用です。公開されず、掲載情報へ自動で反映されることもありません。送信にはメールでの確認が必要です。
      </Text>

      {reportType === 'dog_ok_vote' ? (
        <Section title="このお店で、犬と過ごせましたか？">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {VOTE_CHOICES.map((c) => (
              <Chip key={c} label={VOTE_LABEL[c]} selected={draft.voteChoice === c} onPress={() => update({ voteChoice: c })} />
            ))}
          </View>
        </Section>
      ) : (
        <Section title="対象の項目">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {TARGET_FIELDS.map((f) => (
              <Chip key={f} label={FIELD_LABEL[f]} selected={draft.targetField === f} onPress={() => update({ targetField: f })} />
            ))}
          </View>
        </Section>
      )}

      <Section title={reportType === 'dog_ok_vote' ? '補足（任意）' : '内容'}>
        <TextInput
          value={draft.body}
          onChangeText={(t) => update({ body: t })}
          multiline
          maxLength={REPORT_BODY_MAX}
          placeholder={reportType === 'dog_ok_vote' ? '例：店内奥の席のみ案内されました' : '例：犬同伴はテラス席のみに変わっていました'}
          placeholderTextColor={colors.textMuted}
          style={[inputStyle, { minHeight: 120, textAlignVertical: 'top', paddingTop: space.sm }]}
          accessibilityLabel="内容"
        />
        <Text style={type.small}>
          {draft.body.length}/{REPORT_BODY_MAX}文字。お名前・電話番号などの個人情報は書かないでください。
        </Text>
      </Section>

      <Section title="訪問日（任意）">
        <TextInput
          value={visitedText}
          onChangeText={(t) => {
            setVisitedText(t);
            update({ visitedOn: t.trim() === '' ? null : t.trim().replace(/\//g, '-') });
          }}
          placeholder="例：2026-07-15"
          placeholderTextColor={colors.textMuted}
          style={inputStyle}
          accessibilityLabel="訪問日（年-月-日）。任意"
        />
        {errors.includes('visitedOn') || errors.includes('visitedOn_future') ? (
          <Text style={{ color: colors.bad }}>訪問日は「2026-07-15」の形式で、今日以前の日付を入力してください</Text>
        ) : null}
      </Section>

      {phase === 'auth' && !auth.signedIn ? (
        <Section title="メールで確認">
          <Text style={type.small}>入力内容はこの端末に保持しています。確認が終わると送信できます。</Text>
          <OtpLogin onSignedIn={() => setPhase('form')} />
        </Section>
      ) : null}

      <Button
        label={auth.signedIn ? (isDemo ? 'デモとして端末に保存' : '送信する') : 'メールで確認して送信'}
        onPress={submit}
        loading={sending}
        disabled={errors.length > 0}
        disabledReason={
          errors.length > 0
            ? reportType === 'dog_ok_vote'
              ? '選択肢を1つ選んでください'
              : '対象の項目を選び、内容を入力してください'
            : undefined
        }
        style={{ marginTop: space.xl }}
      />
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
