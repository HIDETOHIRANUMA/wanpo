import React from 'react';
import { View } from 'react-native';
import { EmptyState } from './components';
import { colors } from './theme';

export function MapUnavailable({ reason }: { reason: string }) {
  return (
    <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.bg }} accessibilityRole="text">
      <EmptyState icon="map-outline" title="地図を表示できません" body={`${reason}\n上の「一覧」に切り替えると、同じ条件の施設を距離順で確認できます。`} />
    </View>
  );
}
