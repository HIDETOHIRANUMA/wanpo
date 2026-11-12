import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider } from '@/state/AppContext';
import { colors, space, type } from '@/ui/theme';

/** 本番モードで設定が不足しているときの画面（デモへ自動で切り替えない・技術情報は出さない） */
function Unavailable() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: space.xl }}>
      <Text style={[type.heading, { textAlign: 'center' }]}>現在ご利用いただけません</Text>
      <Text style={[type.body, { textAlign: 'center', marginTop: space.sm }]}>時間をおいて、もう一度お試しください。</Text>
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AppProvider fallback={<Unavailable />}>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.bg },
            headerTintColor: colors.primary,
            headerTitleStyle: { color: colors.text },
            contentStyle: { backgroundColor: colors.bg },
            headerBackTitle: '戻る',
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="place/[id]" options={{ title: '施設の詳細' }} />
          <Stack.Screen name="report/[placeId]" options={{ title: '情報の修正を知らせる' }} />
          <Stack.Screen name="account" options={{ title: 'アカウント' }} />
          <Stack.Screen name="privacy" options={{ title: 'プライバシーについて' }} />
        </Stack>
      </AppProvider>
    </SafeAreaProvider>
  );
}
