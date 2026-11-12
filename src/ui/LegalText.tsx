import React from 'react';
import { Text, View } from 'react-native';
import { appConfig } from '@/data/config';
import { Card, Icon } from './components';
import { colors, space, type } from './theme';

/** 規約・ポリシーの本文段落 */
export function P({ children }: { children: React.ReactNode }) {
  return <Text style={[type.body, { color: colors.text }]}>{children}</Text>;
}

/** 箇条書き */
export function Li({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <Text style={[type.body, { color: colors.primary }]}>•</Text>
      <Text style={[type.body, { flex: 1 }]}>{children}</Text>
    </View>
  );
}

/** 運営者・お問い合わせ先（未設定なら未設定と表示する） */
export function OperatorCard() {
  const { operatorName, supportEmail } = appConfig;
  return (
    <Card style={{ gap: space.xs }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Icon name="business-outline" size={16} color={colors.primary} />
        <Text style={type.label}>運営者：{operatorName ?? '（未設定・公開前に記載します）'}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Icon name="mail-outline" size={16} color={colors.primary} />
        <Text style={type.label} selectable>
          お問い合わせ：{supportEmail ?? '（未設定・公開前に記載します）'}
        </Text>
      </View>
    </Card>
  );
}
