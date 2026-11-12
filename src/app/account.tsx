import { router } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Platform, ScrollView, Text, View } from 'react-native';
import { useApp } from '@/state/AppContext';
import { Button, Card, DemoBanner, Notice, Section } from '@/ui/components';
import { errorMessage } from '@/ui/errors';
import { OtpLogin } from '@/ui/OtpLogin';
import { colors, space, type } from '@/ui/theme';

function confirmDelete(): Promise<boolean> {
  const msg =
    'アカウントと、あなたが送った報告・回答・口コミ・犬の写真をサーバーから削除します。元に戻せません。端末に保存した施設と犬の条件は残ります（別途「この端末のデータを削除」で消せます）。';
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
  const [busy, setBusy] = useState<null | 'logout' | 'delete' | 'unblock'>(null);
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
      setMessage(isDemo ? 'デモの模擬アカウントと端末内のデモ報告・口コミ・写真を削除しました（サーバーのアカウントはありません）。' : 'アカウントと報告・口コミ・写真を削除しました。');
    } catch (e) {
      setError(errorMessage(e, 'アカウントを削除できませんでした。削除は完了していません。'));
    } finally {
      setBusy(null);
    }
  };

  const unblock = async () => {
    setBusy('unblock');
    setError(null);
    try {
      const n = await backend.ugc.unblockAll();
      setMessage(n > 0 ? `${n}人のブロックを解除しました。` : 'ブロックしている人はいません。');
    } catch (e) {
      setError(errorMessage(e, 'ブロックを解除できませんでした。'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: space.lg, paddingBottom: 48 }}>
      {isDemo ? <DemoBanner /> : null}
      <Notice
        tone="info"
        icon="person-circle-outline"
        title="ログインが必要なのは投稿するときだけです"
        body="口コミ・犬の写真・情報の報告・通報に使います。検索・保存・犬の条件はログインなしで使えます。"
      />
      {message ? (
        <View style={{ marginTop: space.md }}>
          <Notice tone="info" icon="checkmark-circle" title={message} />
        </View>
      ) : null}
      {error ? (
        <View style={{ marginTop: space.md }}>
          <Notice tone="bad" title={error} />
        </View>
      ) : null}
      {auth.signedIn ? (
        <>
          <Section title="ログイン中" icon="person-outline">
            <Card style={{ gap: space.md }}>
              <Text style={type.body}>{auth.simulated ? 'デモの模擬ログイン（実際の認証ではありません）' : auth.maskedEmail}</Text>
              <Button label="ログアウト" icon="log-out-outline" variant="outline" onPress={logout} loading={busy === 'logout'} />
            </Card>
          </Section>
          <Section title="ブロックの解除" icon="ban-outline">
            <Card style={{ gap: space.md }}>
              <Text style={type.small}>ブロックした投稿者の口コミ・写真は、あなたには表示されません。すべて解除すると再び表示されます。</Text>
              <Button label="ブロックをすべて解除" icon="refresh" variant="outline" onPress={unblock} loading={busy === 'unblock'} />
            </Card>
          </Section>
          <Section title="アカウントの削除" icon="trash-outline">
            <Card style={{ gap: space.md }}>
              <Text style={type.small}>サーバーで本人を確認したうえで、アカウントとあなたの報告・回答・口コミ・犬の写真を削除します。</Text>
              <Button label="アカウントを削除" icon="trash-outline" variant="danger" onPress={remove} loading={busy === 'delete'} />
            </Card>
          </Section>
        </>
      ) : (
        <Section title="メールでログイン" icon="mail-outline">
          <Card>
            <OtpLogin onSignedIn={() => setMessage(isDemo ? 'デモの模擬ログイン状態になりました。' : 'ログインしました。')} />
          </Card>
        </Section>
      )}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.xl }}>
        <Button label="プライバシーについて" icon="shield-outline" variant="ghost" size="sm" onPress={() => router.push('/privacy')} />
        <Button label="利用規約" icon="document-text-outline" variant="ghost" size="sm" onPress={() => router.push('/terms')} />
      </View>
    </ScrollView>
  );
}
