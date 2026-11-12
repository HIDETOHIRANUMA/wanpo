import { router } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CARRY_METHOD_LABEL } from '@/domain/labels';
import { CARRY_METHODS, type CarryMethod, type Tri } from '@/domain/types';
import { useApp } from '@/state/AppContext';
import { Button, Chip, DemoBanner, Loading, Section } from '@/ui/components';
import { colors, MIN_TAP, radius, space, type } from '@/ui/theme';

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
  const [saving, setSaving] = useState(false);

  const weightNum = weight.trim() === '' ? null : Number(weight.replace(/[０-９．]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)));
  const weightInvalid = weightNum !== null && (!Number.isFinite(weightNum) || weightNum <= 0 || weightNum >= 120);

  const onSave = async () => {
    if (weightInvalid) return;
    setSaving(true);
    try {
      await saveProfile({ name: name.trim() || null, weightKg: weightNum, carryMethods: methods, canBringCertificate: cert });
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
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        <Text style={type.title} accessibilityRole="header">
          犬の条件
        </Text>
        <Text style={[type.small, { marginTop: space.xs }]}>
          登録は任意です。この端末にだけ保存され、送信されません。未入力の項目は「不明」として扱い、施設の条件は「確認が必要」と表示します。
        </Text>

        <Section title="名前・ニックネーム（任意）">
          <TextInput value={name} onChangeText={(t) => { setName(t); setMessage(null); }} maxLength={30} placeholder="例：こむぎ" placeholderTextColor={colors.textMuted} style={inputStyle} accessibilityLabel="犬の名前またはニックネーム" />
        </Section>

        <Section title="体重（kg）">
          <TextInput
            value={weight}
            onChangeText={(t) => { setWeight(t); setMessage(null); }}
            keyboardType="decimal-pad"
            placeholder="未入力＝不明"
            placeholderTextColor={colors.textMuted}
            style={inputStyle}
            accessibilityLabel="体重（キログラム）。未入力は不明"
          />
          {weightInvalid ? <Text style={{ color: colors.bad }}>0より大きく120未満の数値で入力してください</Text> : null}
          <Button label="体重を不明にする" variant="ghost" onPress={() => setWeight('')} />
        </Section>

        <Section title="対応できる同伴方法（複数選択）">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {CARRY_METHODS.map((m) => (
              <Chip key={m} label={CARRY_METHOD_LABEL[m]} selected={methods.includes(m)} onPress={() => toggleMethod(m)} />
            ))}
          </View>
          <Text style={type.small}>
            {methods.length === 0 ? '未選択：不明として扱います（すべての方法に対応できるとはみなしません）' : `選択中：${methods.map((m) => CARRY_METHOD_LABEL[m]).join('・')}`}
          </Text>
        </Section>

        <Section title="証明書（ワクチン接種証明等）を持参できるか">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {(['yes', 'no', 'unknown'] as Tri[]).map((t) => (
              <Chip key={t} label={t === 'yes' ? '持参できる' : t === 'no' ? '持参できない' : '不明'} selected={cert === t} onPress={() => { setCert(t); setMessage(null); }} />
            ))}
          </View>
        </Section>

        <Button label="この内容で保存" onPress={onSave} loading={saving} disabled={weightInvalid} disabledReason={weightInvalid ? '体重の入力を確認してください' : undefined} style={{ marginTop: space.xl }} />
        {message ? (
          <Text style={[type.body, { marginTop: space.sm }]} accessibilityLiveRegion="polite">
            {message}
          </Text>
        ) : null}

        <Section title="設定">
          <Button label={auth.signedIn ? `アカウント（${auth.simulated ? 'デモの模擬ログイン中' : auth.maskedEmail ?? 'ログイン中'}）` : 'ログイン（情報修正の報告用）'} variant="secondary" onPress={() => router.push('/account')} />
          <Button label="位置情報とプライバシーについて" variant="secondary" onPress={() => router.push('/privacy')} />
          <Button
            label="この端末のデータを削除"
            variant="danger"
            onPress={async () => {
              const ok = await confirm('端末のデータを削除', '保存した施設・犬の条件・報告の下書きをこの端末から削除します。ログイン状態やアカウントは削除されません。', '削除する');
              if (!ok) return;
              await clearLocalData();
              setMessage('この端末の保存データを削除しました。');
            }}
          />
          <Text style={type.small}>アカウントの削除は「アカウント」画面から行えます。</Text>
        </Section>
      </ScrollView>
    </SafeAreaView>
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
