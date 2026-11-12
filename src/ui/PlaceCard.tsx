import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatDistance } from '@/domain/geo';
import { CATEGORY_LABEL, OPERATING_LABEL } from '@/domain/labels';
import type { SearchResult } from '@/domain/search';
import type { UgcCounts } from '@/domain/ugc';
import { useApp } from '@/state/AppContext';
import { Badge, Button } from './components';
import { PlaceHero } from './PlaceVisual';
import { availabilityBadge, baseBadge, fitBadge, freshnessText } from './status';
import { dogConditionSummary, usageSummary, zoneSummary } from './summaries';
import { colors, radius, space, type } from './theme';

export function PlaceCard({ result, originLabel, counts }: { result: SearchResult; originLabel: string; counts?: UgcCounts }) {
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
        style={({ pressed }) => [pressed && { opacity: 0.88 }]}
      >
        <PlaceHero place={place} />
        <View style={styles.body}>
          <Text style={type.heading}>{place.name}</Text>
          <Text style={type.small}>
            {place.areaName ? `${place.areaName}・` : ''}
            {CATEGORY_LABEL[place.category]}
            {place.operatingStatus !== 'normal' ? ` ・${OPERATING_LABEL[place.operatingStatus]}` : ''}
            {` ・${originLabel}から直線 ${formatDistance(distanceKm)}`}
          </Text>

          {place.atmosphereTags.length ? (
            <View style={styles.tags} accessibilityLabel={`雰囲気：${place.atmosphereTags.join('、')}`}>
              {place.atmosphereTags.map((t) => (
                <Text key={t} style={styles.tag}>
                  {t}
                </Text>
              ))}
            </View>
          ) : null}

          <View style={styles.meta}>
            <Text style={styles.metaText}>💬 口コミ {counts?.reviewCount ?? 0}件</Text>
            <Text style={styles.metaText}>🐶 犬の写真 {counts?.photoCount ?? 0}枚</Text>
            {place.reservationUrl ? <Text style={[styles.metaText, styles.reserve]}>予約ページあり</Text> : null}
          </View>

          <View style={styles.divider} />

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
        </View>
      </Pressable>
      <View style={{ paddingHorizontal: space.lg, paddingBottom: space.lg }}>
        <Button label={saved ? '保存済み（タップで解除）' : '保存する'} variant={saved ? 'secondary' : 'primary'} onPress={onSave} loading={busy} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginHorizontal: space.lg,
    marginBottom: space.lg,
    overflow: 'hidden',
  },
  body: { padding: space.lg, gap: space.sm },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: {
    fontSize: 13,
    color: colors.text,
    backgroundColor: colors.mint,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, alignItems: 'center' },
  metaText: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  reserve: { color: colors.primary },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 2 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
