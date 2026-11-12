import * as Crypto from 'expo-crypto';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Image, ScrollView, Text, TextInput, View } from 'react-native';
import { RepoError } from '@/data/repository';
import type { Place } from '@/domain/types';
import { PHOTO_CAPTION_MAX, type PreparedImage, type UgcSubmitResult } from '@/domain/ugc';
import { useApp } from '@/state/AppContext';
import { Button, Card, DemoBanner, ErrorState, Loading, Section } from '@/ui/components';
import { errorMessage } from '@/ui/errors';
import { pickAndPreparePhoto } from '@/ui/imagePrep';
import { OtpLogin } from '@/ui/OtpLogin';
import { colors, MIN_TAP, radius, space, type } from '@/ui/theme';

const RULES = [
  '写っているのは犬と、お店の中の様子だけにしてください',
  '人の顔・車のナンバー・他のお客さんの持ち物などが分かる写真は投稿しないでください',
  'お店のメニュー表や他サイトの画像の転載はできません',
  '自分で撮影した写真だけを投稿してください',
];

export default function PhotoUploadScreen() {
  const params = useLocalSearchParams<{ placeId: string }>();
  const placeId = String(params.placeId);
  const { backend, auth, isDemo } = useApp();
  const [place, setPlace] = useState<Place | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<RepoError | null>(null);
  const [image, setImage] = useState<PreparedImage | null>(null);
  const [caption, setCaption] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [phase, setPhase] = useState<'form' | 'auth' | 'done'>('form');
  const [busy, setBusy] = useState<null | 'pick' | 'send'>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [result, setResult] = useState<UgcSubmitResult | null>(null);
  // 同じ写真の再送で重複しないよう、写真を選ぶたびに受付IDを作り直す
  const requestId = useRef(Crypto.randomUUID());

  useEffect(() => {
    backend.places
      .getPlace(placeId)
      .then(setPlace)
      .catch((e) => setLoadError(e instanceof RepoError ? e : new RepoError('network')));
  }, [backend, placeId]);

  if (loadError) return <ErrorState message={errorMessage(loadError, '施設情報を読み込めませんでした。')} />;
  if (place === undefined) return <Loading />;
  if (place === null) return <ErrorState message="現在の掲載情報を確認できないため、写真を投稿できません。" />;

  const pick = async () => {
    setBusy('pick');
    setMessage(null);
    const r = await pickAndPreparePhoto({ forDemo: isDemo });
    setBusy(null);
    if (r.ok) {
      setImage(r.image);
      requestId.current = Crypto.randomUUID();
    } else if (r.reason === 'failed') setMessage('写真を読み込めませんでした。別の写真をお試しください。');
  };

  const send = async () => {
    if (!image || !agreed) return;
    if (!auth.signedIn) {
      setPhase('auth');
      return;
    }
    setBusy('send');
    setMessage(null);
    try {
      const r = await backend.ugc.submitPhoto({ requestId: requestId.current, placeId, caption: caption.trim(), image });
      setResult(r);
      setPhase('done');
    } catch (e) {
      if (e instanceof RepoError && e.kind === 'auth_required') setPhase('auth');
      setMessage(errorMessage(e, '投稿できませんでした。'));
    } finally {
      setBusy(null);
    }
  };

  if (phase === 'done' && result) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: space.lg, gap: space.md }}>
        <Stack.Screen options={{ title: '犬の写真を投稿' }} />
        {isDemo ? <DemoBanner /> : null}
        <Card style={{ gap: space.sm }}>
          <Text style={type.heading}>
            {result.storedAt === 'demo_local' ? 'この端末にデモとして保存しました' : result.status === 'approved' ? '写真を公開しました' : '写真を受け付けました'}
          </Text>
          <Text style={type.body}>
            {result.storedAt === 'demo_local'
              ? 'デモのため送信はしていません。この端末の施設ページにだけ表示されます。'
              : result.status === 'approved'
                ? '施設ページに表示されます。通報により非表示になることがあります。自分の写真はいつでも削除できます。'
                : '運営の確認後に公開されます。'}
          </Text>
        </Card>
        <Button label="施設の詳細に戻る" onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: space.lg, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: '犬の写真を投稿' }} />
      {isDemo ? <DemoBanner /> : null}
      <Text style={type.heading}>{place.name}</Text>
      <Text style={type.small}>
        このお店で過ごした犬の写真を共有できます。写真は縮小して送り、撮影場所などの位置情報は含めません。
      </Text>

      <Section title="写真">
        {image ? (
          <Image
            source={{ uri: image.dataUri ?? image.uri }}
            style={{ width: '100%', aspectRatio: image.width && image.height ? image.width / image.height : 4 / 3, borderRadius: radius.md, backgroundColor: colors.mint }}
            resizeMode="cover"
            accessibilityLabel="選んだ写真"
          />
        ) : (
          <View style={{ height: 160, borderRadius: radius.md, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 34 }}>🐶</Text>
            <Text style={type.small}>写真がまだ選ばれていません</Text>
          </View>
        )}
        <Button label={image ? '別の写真を選ぶ' : '写真を選ぶ'} variant="secondary" onPress={pick} loading={busy === 'pick'} />
      </Section>

      <Section title="ひとこと（任意）">
        <TextInput
          value={caption}
          onChangeText={setCaption}
          maxLength={PHOTO_CAPTION_MAX}
          placeholder="例：店内の涼しい席でひと休み"
          placeholderTextColor={colors.textMuted}
          style={inputStyle}
          accessibilityLabel="写真のひとこと"
        />
      </Section>

      <Section title="投稿のルール">
        {RULES.map((r) => (
          <Text key={r} style={type.body}>
            ・{r}
          </Text>
        ))}
        <Button
          label={agreed ? '✓ ルールを確認しました' : 'ルールを確認しました'}
          variant={agreed ? 'primary' : 'secondary'}
          onPress={() => setAgreed(!agreed)}
          accessibilityHint="投稿のルールを確認したことを示します"
        />
      </Section>

      {phase === 'auth' && !auth.signedIn ? (
        <Section title="メールで確認">
          <Text style={type.small}>確認が終わると投稿できます。</Text>
          <OtpLogin onSignedIn={() => setPhase('form')} />
        </Section>
      ) : null}

      <Button
        label={auth.signedIn ? (isDemo ? 'デモとして端末に保存' : '投稿する') : 'メールで確認して投稿'}
        onPress={send}
        loading={busy === 'send'}
        disabled={!image || !agreed}
        disabledReason={!image ? '写真を選んでください' : !agreed ? '投稿のルールを確認してください' : undefined}
        style={{ marginTop: space.xl }}
      />
      <Text style={[type.small, { marginTop: space.sm }]}>写真の投稿は1日5枚までです。</Text>
      {message ? (
        <Text style={{ color: colors.bad, marginTop: space.md }} accessibilityLiveRegion="assertive">
          {message}
        </Text>
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
