import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider, useApp } from '@/state/AppContext';
import { EmptyState } from '@/ui/components';
import { colors, space } from '@/ui/theme';

// 保存済みの設定を読み終えるまで起動画面を出しておく（一瞬だけ初回案内が見えるのを防ぐ）
SplashScreen.preventAutoHideAsync().catch(() => {});
const hideSplash = () => {
  SplashScreen.hideAsync().catch(() => {});
};

function SplashGate() {
  const { ready } = useApp();
  useEffect(() => {
    if (ready) hideSplash();
  }, [ready]);
  return null;
}

/** 本番モードで設定が不足しているときの画面（デモへ自動で切り替えない・技術情報は出さない） */
function Unavailable() {
  useEffect(hideSplash, []);
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', padding: space.xl }}>
      <EmptyState icon="cloud-offline-outline" title="現在ご利用いただけません" body="時間をおいて、もう一度お試しください。" tone="warn" />
    </View>
  );
}

export default function RootLayout() {
  // 読み込みが長引いても起動画面に閉じ込めない
  useEffect(() => {
    const t = setTimeout(hideSplash, 4000);
    return () => clearTimeout(t);
  }, []);
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AppProvider fallback={<Unavailable />}>
        <SplashGate />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.surface },
            headerShadowVisible: false,
            headerTintColor: colors.primary,
            headerTitleStyle: { color: colors.text, fontWeight: '700', fontSize: 16 },
            contentStyle: { backgroundColor: colors.bg },
            headerBackTitle: '戻る',
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false, animation: 'fade' }} />
          <Stack.Screen name="terms" options={{ title: '利用規約・投稿ガイドライン' }} />
          <Stack.Screen name="place/[id]" options={{ title: '施設の詳細' }} />
          <Stack.Screen name="report/[placeId]" options={{ title: '情報の修正を知らせる' }} />
          <Stack.Screen name="account" options={{ title: 'アカウント' }} />
          <Stack.Screen name="privacy" options={{ title: 'プライバシーについて' }} />
        </Stack>
      </AppProvider>
    </SafeAreaProvider>
  );
}
