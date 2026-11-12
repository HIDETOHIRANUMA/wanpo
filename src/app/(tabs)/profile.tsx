import { router } from 'expo-router';
import React, { useState } from 'react';
import Constants from 'expo-constants';
import { Alert, Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CARRY_METHOD_LABEL, DOG_SIZE_LABEL } from '@/domain/labels';
import { CARRY_METHODS, EMPTY_DOG_PROFILE, sizeFromWeight, type CarryMethod, type Tri } from '@/domain/types';
import { useApp } from '@/state/AppContext';
import { Button, Card, Chip, DemoBanner, ListRow, Loading, Notice, ScreenHeader, Section, Segmented, TextField } from '@/ui/components';
import { colors, space, type } from '@/ui/theme';

const APP_VERSION = Constants.expoConfig?.version ?? '';

function confirm(title: string, message: string, ok: string): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(globalThis.confirm?.(`${title}\n${message}`) ?? false);
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: 'キャンセル', style: 'cancel', onPress: () => resolve(false) },
      { text: ok, style: 'destructive', onPress: () => resolve(true) },
    ]),
  );
}

export default function ProfileScreen() {
  const { ready, profile } = useApp();
  // 完了メッセージはフォームの作り直しをまたいで保持する
  const [message, setMessage] = useState<string | null>(null);
  if (!ready) return <Loading />;
  // 保存済みプロフィールが変わったら（保存・端末データ削除）フォームを作り直す
  return <ProfileForm key={JSON.stringify(profile)} message={message} setMessage={setMessage} />;
}

function ProfileForm({ message, setMessage }: { message: string | null; setMessage: (m: string | null) => void }) {
  const { profile, saveProfile, isDemo, auth, clearLocalData } = useApp();
  const [name, setName] = useState(profile?.name ?? '');
  const [weight, setWeight] = useState(profile?.weightKg != null ? String(profile.weightKg) : '');
  const [methods, setMethods] = useState<CarryMethod[]>(profile?.carryMethods ?? []);
  const [cert, setCert] = useState<Tri>(profile?.canBringCertificate ?? 'unknown');
  const [breed, setBreed] = useState(profile?.breed ?? '');
  const [brachy, setBrachy] = useState<Tri>(profile?.brachycephalic ?? 'unknown');
  const [count, setCount] = useState<number>(profile?.dogCount ?? 1);
  const [saving, setSaving] = useState(false);

  const weightNum = weight.trim() === '' ? null : Number(weight.replace(/[０-９．]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)));
  const weightInvalid = weightNum !== null && (!Number.isFinite(weightNum) || weightNum <= 0 || weightNum >= 120);

  const onSave = async () => {
    if (weightInvalid) return;
    setSaving(true);
    try {
      await saveProfile({
        ...(profile ?? EMPTY_DOG_PROFILE),
        name: name.trim() || null,
        weightKg: weightNum,
        carryMethods: methods,
        canBringCertificate: cert,
        breed: breed.trim() || null,
        brachycephalic: brachy,
        dogCount: count,
      });
      setMessage('この端末に保存しました。');
    } catch {
      setMessage('保存できませんでした。もう一度お試しください。');
    } finally {
      setSaving(false);
    }
  };

  const toggleMethod = (m: CarryMethod) => {
    setMessage(null);
    setMethods((cur) => (cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m]));
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      {isDemo ? <DemoBanner /> : null}
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        <ScreenHeader title="マイページ" subtitle="犬の条件と設定" />
        <View style={{ paddingHorizontal: space.lg }}>
          <Notice
            tone="info"
            icon="lock-closed-outline"
            title="犬の条件の登録は任意です"
            body="この端末にだけ保存され、送信されません。未入力の項目は「不明」として扱い、施設の条件は「確認が必要」と表示します。"
          />

          <Section title="うちの犬" icon="paw-outline">
            <Card style={{ gap: space.md }}>
              <TextField
                label="名前・ニックネーム（任意）"
                value={name}
                onChangeText={(t) => {
                  setName(t);
                  setMessage(null);
                }}
                maxLength={30}
                placeholder="例：こむぎ"
                icon="happy-outline"
                accessibilityLabel="犬の名前またはニックネーム"
              />
              <TextField
                label="体重（kg）"
                value={weight}
                onChangeText={(t) => {
                  setWeight(t);
                  setMessage(null);
                }}
                keyboardType="decimal-pad"
                placeholder="未入力＝不明"
                icon="scale-outline"
                accessibilityLabel="体重（キログラム）。未入力は不明"
                error={weightInvalid ? '0より大きく120未満の数値で入力してください' : null}
              />
              {weight ? <Button label="体重を不明にする" variant="ghost" size="sm" onPress={() => setWeight('')} style={{ alignSelf: 'flex-start' }} /> : null}
              {!weightInvalid && sizeFromWeight(weightNum) ? (
                <Text style={type.caption}>大きさの目安：{DOG_SIZE_LABEL[sizeFromWeight(weightNum)!]}（口コミ・写真で似た犬を探すときに使います）</Text>
              ) : null}
              <TextField
                label="犬種（任意）"
                value={breed}
                onChangeText={(t) => {
                  setBreed(t);
                  setMessage(null);
                }}
                maxLength={30}
                placeholder="例：トイプードル、MIX"
                icon="paw-outline"
                accessibilityLabel="犬種"
              />
              <View style={{ gap: space.xs }}>
                <Text style={type.label}>短頭種ですか？</Text>
                <Text style={type.caption}>フレンチブルドッグ・パグ・シーズーなど。暑さに弱く、夏は入店を断るお店があります</Text>
                <Segmented
                  value={brachy}
                  onChange={(t) => {
                    setBrachy(t);
                    setMessage(null);
                  }}
                  options={[
                    { value: 'yes', label: 'はい' },
                    { value: 'no', label: 'いいえ' },
                    { value: 'unknown', label: '不明' },
                  ]}
                />
              </View>
            </Card>
          </Section>

          <Section title="一緒に行く頭数" icon="people-outline" subtitle="1組あたりの頭数制限と照合します">
            <Segmented
              value={String(count)}
              onChange={(v) => {
                setCount(Number(v));
                setMessage(null);
              }}
              options={[
                { value: '1', label: '1頭' },
                { value: '2', label: '2頭' },
                { value: '3', label: '3頭' },
                { value: '4', label: '4頭以上' },
              ]}
            />
          </Section>

          <Section title="対応できる同伴方法" icon="bag-handle-outline" subtitle="複数選択できます">
            <Card style={{ gap: space.md }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                {CARRY_METHODS.map((m) => (
                  <Chip key={m} label={CARRY_METHOD_LABEL[m]} selected={methods.includes(m)} onPress={() => toggleMethod(m)} />
                ))}
              </View>
              <Text style={type.caption}>
                {methods.length === 0 ? '未選択：不明として扱います（すべての方法に対応できるとはみなしません）' : `選択中：${methods.map((m) => CARRY_METHOD_LABEL[m]).join('・')}`}
              </Text>
            </Card>
          </Section>

          <Section title="証明書（ワクチン接種証明等）" icon="ribbon-outline" subtitle="持参できるか">
            <Segmented
              value={cert}
              onChange={(t) => {
                setCert(t);
                setMessage(null);
              }}
              options={[
                { value: 'yes', label: '持参できる' },
                { value: 'no', label: '持参できない' },
                { value: 'unknown', label: '不明' },
              ]}
            />
          </Section>

          <Button
            label="この内容で保存"
            icon="checkmark"
            size="lg"
            onPress={onSave}
            loading={saving}
            disabled={weightInvalid}
            disabledReason={weightInvalid ? '体重の入力を確認してください' : undefined}
            style={{ marginTop: space.xl }}
          />
          {message ? (
            <View style={{ marginTop: space.sm }}>
              <Notice tone="info" icon="checkmark-circle" title={message} />
            </View>
          ) : null}

          <Section title="うちの子カード" icon="id-card-outline" subtitle="入店時にお店の方へ見せられます">
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              <ListRow
                icon="id-card-outline"
                title="うちの子カードを見る・編集する"
                subtitle="ワクチン接種日・性格・お店へのひとこと（この端末だけに保存）"
                last
                onPress={() => router.push('/dog-card')}
              />
            </Card>
          </Section>

          <Section title="設定" icon="settings-outline">
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              <ListRow
                icon="person-circle-outline"
                title={auth.signedIn ? 'アカウント' : 'ログイン'}
                subtitle={auth.signedIn ? (auth.simulated ? 'デモの模擬ログイン中' : auth.maskedEmail ?? 'ログイン中') : '口コミ・写真・情報の報告に使います'}
                onPress={() => router.push('/account')}
              />
              <ListRow icon="shield-outline" title="位置情報とプライバシー" onPress={() => router.push('/privacy')} />
              <ListRow icon="document-text-outline" title="利用規約・投稿ガイドライン" onPress={() => router.push('/terms')} />
              <ListRow icon="sparkles-outline" title="使い方をもう一度見る" onPress={() => router.push('/onboarding')} />
              <ListRow
                icon="trash-outline"
                title="この端末のデータを削除"
                subtitle="保存した施設・犬の条件・下書き"
                danger
                last
                onPress={async () => {
                  const ok = await confirm('端末のデータを削除', '保存した施設・犬の条件・報告の下書きをこの端末から削除します。ログイン状態やアカウントは削除されません。', '削除する');
                  if (!ok) return;
                  await clearLocalData();
                  setMessage('この端末の保存データを削除しました。');
                }}
              />
            </Card>
            <Text style={type.caption}>アカウントの削除は「アカウント」画面から行えます。</Text>
          </Section>
          <Text style={[type.caption, { textAlign: 'center', marginTop: space.xl }]}>犬と涼める　バージョン {APP_VERSION}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
