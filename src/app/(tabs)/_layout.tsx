import { Redirect, Tabs } from 'expo-router';
import React from 'react';
import { useApp } from '@/state/AppContext';
import { Icon, type IconName } from '@/ui/components';
import { colors } from '@/ui/theme';

const icon = (on: IconName, off: IconName) =>
  function TabIcon({ color, focused }: { color: import('react-native').ColorValue; focused: boolean }) {
    return <Icon name={focused ? on : off} size={23} color={String(color)} />;
  };

export default function TabsLayout() {
  const { ready, onboarded } = useApp();
  // 初回起動時は使い方の案内を先に表示する
  if (ready && !onboarded) return <Redirect href="/onboarding" />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSubtle,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, minHeight: 58, paddingTop: 4 },
        tabBarLabelStyle: { fontSize: 11.5, fontWeight: '700' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: '探す', tabBarIcon: icon('search', 'search-outline'), tabBarAccessibilityLabel: '探す' }} />
      <Tabs.Screen name="saved" options={{ title: '保存', tabBarIcon: icon('heart', 'heart-outline'), tabBarAccessibilityLabel: '保存' }} />
      <Tabs.Screen name="profile" options={{ title: 'マイページ', tabBarIcon: icon('paw', 'paw-outline'), tabBarAccessibilityLabel: '犬の条件・設定' }} />
    </Tabs>
  );
}
