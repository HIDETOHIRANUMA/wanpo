import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatDistance } from '@/domain/geo';
import { CATEGORY_LABEL, OPERATING_LABEL } from '@/domain/labels';
import type { SearchResult } from '@/domain/search';
import { useApp } from '@/state/AppContext';
import { Badge, Button, CategoryPlaceholder } from './components';
import { availabilityBadge, baseBadge, fitBadge, freshnessText } from './status';
import { dogConditionSummary, usageSummary, zoneSummary } from './summaries';
import { colors, radius, space, type } from './theme';

export function PlaceCard({ result, originLabel }: { result: SearchResult; originLabel: string }) {
  const { place, base, fit, freshness, availability, distanceKm } = result;
  const { isSaved, toggleSave, profile } = useApp();
  const [busy, setBusy] = useState(false);
  const saved = isSaved(place.id);

  const onSave = async () => {
    setBusy(true);
    try {
      await toggleSave(place);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.card}>
      <Pressable
        onPress={() => router.push(`/place/${place.id}`)}
        accessibilityRole="button"
        accessibilityLabel={`${place.name}の詳細を見る`}
        style={({ pressed }) => [pressed && { opacity: 0.85 }]}
      >
        <View style={styles.header}>
          <CategoryPlaceholder category={place.category} compact />
          <View style={{ flex: 1 }}>
            <Text style={type.heading}>{place.name}</Text>
            <Text style={type.small}>
              {CATEGORY_LABEL[place.category]}
              {place.operatingStatus !== 'normal' ? ` ・${OPERATING_LABEL[place.operatingStatus]}` : ''}
            </Text>
          </View>
        </View>

        <View style={styles.rows}>
          <Text style={type.body}>
            <Text style={type.label}>犬と過ごせる区画　</Text>
            {zoneSummary(place.zone)}
          </Text>
          <Badge info={baseBadge(base)} />
          {profile ? <Badge info={fitBadge(fit.result)} /> : <Badge info={{ tone: 'neutral', label: '犬の条件は未登録' }} />}
          <Text style={type.small}>
            <Text style={type.label}>犬の条件　</Text>
            {dogConditionSummary(place.zone)}
          </Text>
          <Text style={type.small}>
            <Text style={type.label}>利用条件　</Text>
            {usageSummary(place.usage)}
          </Text>
          <View style={styles.badges}>
            <Badge info={freshnessText(freshness)} />
            <Badge info={availabilityBadge(availability)} />
          </View>
          <Text style={type.small}>
            {originLabel}から直線 {formatDistance(distanceKm)}
          </Text>
        </View>
      </Pressable>
      <Button
        label={saved ? '保存済み（タップで解除）' : '保存する'}
        variant={saved ? 'secondary' : 'primary'}
        onPress={onSave}
        loading={busy}
        style={{ marginTop: space.md }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
    marginHorizontal: space.lg,
    marginBottom: space.md,
  },
  header: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  rows: { marginTop: space.md, gap: space.sm },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
