import { Tabs } from 'expo-router';
import React from 'react';
import { Text } from 'react-native';
import { colors } from '@/ui/theme';

const icon = (glyph: string) =>
  function TabIcon({ color }: { color: import("react-native").ColorValue }) {
    return (
      <Text style={{ color, fontSize: 20 }} accessibilityElementsHidden importantForAccessibility="no">
        {glyph}
      </Text>
    );
  };

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, minHeight: 56 },
        tabBarLabelStyle: { fontSize: 13, fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: '探す', tabBarIcon: icon('⌕'), tabBarAccessibilityLabel: '探す' }} />
      <Tabs.Screen name="saved" options={{ title: '保存', tabBarIcon: icon('♡'), tabBarAccessibilityLabel: '保存' }} />
      <Tabs.Screen name="profile" options={{ title: '犬の条件', tabBarIcon: icon('🐾'), tabBarAccessibilityLabel: '犬の条件・設定' }} />
    </Tabs>
  );
}
