import { router } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Platform, ScrollView, Text } from 'react-native';
import { useApp } from '@/state/AppContext';
import { Button, Card, DemoBanner, Section } from '@/ui/components';
import { errorMessage } from '@/ui/errors';
import { OtpLogin } from '@/ui/OtpLogin';
import { colors, space, type } from '@/ui/theme';

function confirmDelete(): Promise<boolean> {
  const msg =
    'アカウントと、あなたが送った報告・回答をサーバーから削除します。元に戻せません。端末に保存した施設と犬の条件は残ります（別途「この端末のデータを削除」で消せます）。';
  if (Platform.OS === 'web') return Promise.resolve(globalThis.confirm?.(msg) ?? false);
  return new Promise((resolve) =>
    Alert.alert('アカウントを削除', msg, [
      { text: 'キャンセル', style: 'cancel', onPress: () => resolve(false) },
      { text: '削除する', style: 'destructive', onPress: () => resolve(true) },
    ]),
  );
}

export default function AccountScreen() {
  const { auth, backend, isDemo } = useApp();
  const [busy, setBusy] = useState<null | 'logout' | 'delete'>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const logout = async () => {
    setBusy('logout');
    setError(null);
    try {
      await backend.auth.signOut();
      setMessage('ログアウトしました。この端末のログイン情報を破棄しました。');
    } catch (e) {
      setError(errorMessage(e, 'ログアウトできませんでした。'));
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!(await confirmDelete())) return;
    setBusy('delete');
    setError(null);
    try {
      // サーバー側で本人確認・削除が成功したときだけ「削除しました」と表示する
      await backend.auth.deleteAccount();
      setMessage(isDemo ? 'デモの模擬アカウントと端末内のデモ報告を削除しました（サーバーのアカウントはありません）。' : 'アカウントと報告を削除しました。');
    } catch (e) {
      setError(errorMessage(e, 'アカウントを削除できませんでした。削除は完了していません。'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: space.lg, paddingBottom: 48 }}>
      {isDemo ? <DemoBanner /> : null}
      <Text style={type.body}>ログインは「情報の修正を知らせる」ときだけ必要です。検索・保存・犬の条件はログインなしで使えます。</Text>
      {message ? (
        <Card style={{ marginTop: space.md }}>
          <Text style={type.body} accessibilityLiveRegion="polite">
            {message}
          </Text>
        </Card>
      ) : null}
      {error ? (
        <Text style={{ color: colors.bad, marginTop: space.md }} accessibilityLiveRegion="assertive">
          {error}
        </Text>
      ) : null}
      {auth.signedIn ? (
        <>
          <Section title="ログイン中">
            <Text style={type.body}>{auth.simulated ? 'デモの模擬ログイン（実際の認証ではありません）' : auth.maskedEmail}</Text>
            <Button label="ログアウト" variant="secondary" onPress={logout} loading={busy === 'logout'} />
          </Section>
          <Section title="アカウントの削除">
            <Text style={type.small}>サーバーで本人を確認したうえで、アカウントとあなたの報告・回答を削除します。</Text>
            <Button label="アカウントを削除" variant="danger" onPress={remove} loading={busy === 'delete'} />
          </Section>
        </>
      ) : (
        <Section title="メールでログイン">
          <OtpLogin onSignedIn={() => setMessage(isDemo ? 'デモの模擬ログイン状態になりました。' : 'ログインしました。')} />
        </Section>
      )}
      <Button label="プライバシーについて" variant="ghost" onPress={() => router.push('/privacy')} style={{ marginTop: space.xl }} />
    </ScrollView>
  );
}
