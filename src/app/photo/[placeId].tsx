import * as Crypto from 'expo-crypto';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { RepoError } from '@/data/repository';
import { sizeFromWeight, type DogSize, type Place } from '@/domain/types';
import { DogInfoPicker } from '@/ui/DogInfoPicker';
import { PHOTO_CAPTION_MAX, type PreparedImage, type UgcSubmitResult } from '@/domain/ugc';
import { useApp } from '@/state/AppContext';
import { Button, Card, DemoBanner, EmptyState, ErrorState, Icon, Loading, Notice, Section, TextField } from '@/ui/components';
import { TermsConsent } from '@/ui/TermsConsent';
import { errorMessage } from '@/ui/errors';
import { pickAndPreparePhoto } from '@/ui/imagePrep';
import { OtpLogin } from '@/ui/OtpLogin';
import { colors, radius, space, type } from '@/ui/theme';

const RULES = [
  '写っているのは犬と、お店の中の様子だけにしてください',
  '人の顔・車のナンバー・他のお客さんの持ち物などが分かる写真は投稿しないでください',
  'お店のメニュー表や他サイトの画像の転載はできません',
  '自分で撮影した写真だけを投稿してください',
];

export default function PhotoUploadScreen() {
  const params = useLocalSearchParams<{ placeId: string }>();
  const placeId = String(params.placeId);
  const { backend, auth, isDemo, termsAccepted, acceptTerms, profile } = useApp();
  const [place, setPlace] = useState<Place | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<RepoError | null>(null);
  const [image, setImage] = useState<PreparedImage | null>(null);
  const [caption, setCaption] = useState('');
  // 登録した犬の条件から初期値（変更・削除できる）
  const [dog, setDog] = useState<{ dogSize: DogSize | null; dogBreed: string | null }>(() => ({
    dogSize: sizeFromWeight(profile?.weightKg ?? null),
    dogBreed: profile?.breed ?? null,
  }));
  const [agreed, setAgreed] = useState(false);
  const [termsChecked, setTermsChecked] = useState(false);
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

  const termsOk = termsAccepted || termsChecked;
  const send = async () => {
    if (!image || !agreed || !termsOk) return;
    if (!termsAccepted) await acceptTerms();
    if (!auth.signedIn) {
      setPhase('auth');
      return;
    }
    setBusy('send');
    setMessage(null);
    try {
      const r = await backend.ugc.submitPhoto({ requestId: requestId.current, placeId, caption: caption.trim(), image, ...dog });
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
        <EmptyState
          icon="checkmark-circle"
          title={result.storedAt === 'demo_local' ? 'この端末にデモとして保存しました' : result.status === 'approved' ? '写真を公開しました' : '写真を受け付けました'}
          body={
            result.storedAt === 'demo_local'
              ? 'デモのため送信はしていません。この端末の施設ページにだけ表示されます。'
              : result.status === 'approved'
                ? '施設ページに表示されます。通報により非表示になることがあります。自分の写真はいつでも削除できます。'
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
      <Stack.Screen options={{ title: '犬の写真を投稿' }} />
      {isDemo ? <DemoBanner /> : null}
      <Text style={type.title}>{place.name}</Text>
      <Text style={[type.small, { marginTop: 4 }]}>
        このお店で過ごした犬の写真を共有できます。写真は縮小して送り、撮影場所などの位置情報は含めません。
      </Text>

      <Section title="写真" icon="image-outline">
        {image ? (
          <Image
            source={{ uri: image.dataUri ?? image.uri }}
            style={{ width: '100%', aspectRatio: image.width && image.height ? image.width / image.height : 4 / 3, borderRadius: radius.md, backgroundColor: colors.mint }}
            resizeMode="cover"
            accessibilityLabel="選んだ写真"
          />
        ) : (
          <View style={{ height: 180, borderRadius: radius.lg, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.borderStrong, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Icon name="images-outline" size={34} color={colors.primary} />
            <Text style={type.small}>写真がまだ選ばれていません</Text>
          </View>
        )}
        <Button label={image ? '別の写真を選ぶ' : '写真を選ぶ'} icon="images-outline" variant="secondary" onPress={pick} loading={busy === 'pick'} />
      </Section>

      <Section title="写っている犬" icon="paw-outline" subtitle="大きさ・犬種（任意）">
        <DogInfoPicker size={dog.dogSize} breed={dog.dogBreed} onChange={setDog} />
      </Section>

      <Section title="ひとこと（任意）" icon="chatbubble-outline">
        <TextField
          value={caption}
          onChangeText={setCaption}
          maxLength={PHOTO_CAPTION_MAX}
          placeholder="例：店内の涼しい席でひと休み"
          accessibilityLabel="写真のひとこと"
          helper={`${caption.length}/${PHOTO_CAPTION_MAX}文字`}
        />
      </Section>

      <Section title="投稿のルール" icon="shield-checkmark-outline">
        <Card style={{ gap: 6 }}>
          {RULES.map((r) => (
            <View key={r} style={{ flexDirection: 'row', gap: 8 }}>
              <Icon name="checkmark" size={16} color={colors.primary} style={{ marginTop: 3 }} />
              <Text style={[type.body, { flex: 1 }]}>{r}</Text>
            </View>
          ))}
        </Card>
        <Pressable
          onPress={() => setAgreed(!agreed)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: agreed }}
          accessibilityLabel="投稿のルールを確認しました"
          style={[styles.check, agreed && styles.checkOn]}
        >
          <Icon name={agreed ? 'checkbox' : 'square-outline'} size={22} color={agreed ? colors.primary : colors.textSubtle} />
          <Text style={[type.body, { flex: 1, fontWeight: '600' }]}>投稿のルールを確認しました</Text>
        </Pressable>
        <TermsConsent value={termsChecked} onChange={setTermsChecked} alreadyAccepted={termsAccepted} />
      </Section>

      {phase === 'auth' && !auth.signedIn ? (
        <Section title="メールで確認" icon="mail-outline">
          <Text style={type.small}>確認が終わると投稿できます。</Text>
          <OtpLogin onSignedIn={() => setPhase('form')} />
        </Section>
      ) : null}

      <Button
        label={auth.signedIn ? (isDemo ? 'デモとして端末に保存' : '投稿する') : 'メールで確認して投稿'}
        icon="cloud-upload-outline"
        size="lg"
        onPress={send}
        loading={busy === 'send'}
        disabled={!image || !agreed || !termsOk}
        disabledReason={!image ? '写真を選んでください' : !agreed ? '投稿のルールを確認してください' : !termsOk ? '利用規約・投稿ガイドラインへの同意が必要です' : undefined}
        style={{ marginTop: space.xl }}
      />
      <Text style={[type.caption, { marginTop: space.sm }]}>写真の投稿は1日5枚までです。</Text>
      {message ? (
        <View style={{ marginTop: space.md }}>
          <Notice tone="bad" title={message} />
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  check: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface },
  checkOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
});
