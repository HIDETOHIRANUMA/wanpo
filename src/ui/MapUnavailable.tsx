import React from 'react';
import { Text, View } from 'react-native';
import { colors, space, type } from './theme';

export function MapUnavailable({ reason }: { reason: string }) {
  return (
    <View
      style={{ flex: 1, padding: space.xl, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.mint }}
      accessibilityRole="text"
    >
      <Text style={[type.heading, { textAlign: 'center' }]}>地図を表示できません</Text>
      <Text style={[type.body, { textAlign: 'center', marginTop: space.sm }]}>{reason}</Text>
      <Text style={[type.small, { textAlign: 'center', marginTop: space.sm }]}>
        上の「一覧」に切り替えると、同じ条件の施設を距離順で確認できます。
      </Text>
    </View>
  );
}
