import { router } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Button, Icon } from './components';
import { colors, radius, space, type } from './theme';

/**
 * 投稿前の同意（利用規約・投稿ガイドライン）。ストア審査の UGC 要件のため、
 * 初回の投稿では必ず同意を求め、同意はこの端末に記録する（AppContext.acceptTerms）。
 */
export function TermsConsent({ value, onChange, alreadyAccepted }: { value: boolean; onChange: (v: boolean) => void; alreadyAccepted: boolean }) {
  if (alreadyAccepted) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Icon name="checkmark-circle" size={16} color={colors.ok} />
        <Text style={[type.caption, { flex: 1 }]}>利用規約・投稿ガイドラインに同意済みです</Text>
        <Button label="読む" variant="ghost" size="sm" onPress={() => router.push('/terms')} />
      </View>
    );
  }
  return (
    <View style={{ gap: space.xs }}>
      <Pressable
        onPress={() => onChange(!value)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: value }}
        accessibilityLabel="利用規約・投稿ガイドラインに同意する"
        style={({ pressed }) => [
          {
            flexDirection: 'row',
            alignItems: 'center',
            gap: space.sm,
            padding: space.md,
            borderRadius: radius.md,
            borderWidth: 1.5,
            borderColor: value ? colors.primary : colors.border,
            backgroundColor: value ? colors.primarySoft : colors.surface,
          },
          pressed && { opacity: 0.85 },
        ]}
      >
        <Icon name={value ? 'checkbox' : 'square-outline'} size={22} color={value ? colors.primary : colors.textSubtle} />
        <Text style={[type.body, { flex: 1, fontWeight: '600' }]}>利用規約・投稿ガイドラインに同意する</Text>
      </Pressable>
      <Button label="利用規約・投稿ガイドラインを読む" icon="document-text-outline" variant="ghost" size="sm" onPress={() => router.push('/terms')} style={{ alignSelf: 'flex-start' }} />
    </View>
  );
}
