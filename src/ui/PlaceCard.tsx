import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatDistance } from '@/domain/geo';
import { CATEGORY_LABEL, OPERATING_LABEL } from '@/domain/labels';
import type { SearchResult } from '@/domain/search';
import type { UgcCounts } from '@/domain/ugc';
import { useApp } from '@/state/AppContext';
import { Badge, Icon, IconButton, Tag, type IconName } from './components';
import { PlaceHero } from './PlaceVisual';
import { availabilityBadge, baseBadge, fitBadge, freshnessText } from './status';
import { dogConditionSummary, usageSummary, zoneSummary } from './summaries';
import { colors, radius, shadow, space, type } from './theme';

/** 一覧のカード：写真（またはイメージ）・名前・距離・確認状況を先に、細かい条件は短く */
export function PlaceCard({ result, originLabel, counts }: { result: SearchResult; originLabel: string; counts?: UgcCounts }) {
  const { place, base, fit, freshness, availability, distanceKm } = result;
  const { isSaved, toggleSave, profile } = useApp();
  const [busy, setBusy] = useState(false);
  const saved = isSaved(place.id);

  const onSave = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await toggleSave(place);
    } finally {
      setBusy(false);
    }
  };

  const avail = availabilityBadge(availability);
  const fresh = freshnessText(freshness);

  return (
    <View style={styles.card}>
      <Pressable
        onPress={() => router.push(`/place/${place.id}`)}
        accessibilityRole="button"
        accessibilityLabel={`${place.name}の詳細を見る`}
        style={({ pressed }) => [pressed && { opacity: 0.92 }]}
      >
        <PlaceHero place={place} height={172} />
        <View style={styles.body}>
          <View style={{ gap: 4 }}>
            <Text style={styles.name} numberOfLines={2}>
              {place.name}
            </Text>
            <View style={styles.metaRow}>
              <Meta icon="navigate-outline" text={`${formatDistance(distanceKm)}`} strong />
              <Meta icon="storefront-outline" text={CATEGORY_LABEL[place.category]} />
              {place.areaName ? <Meta icon="location-outline" text={place.areaName} /> : null}
              {place.operatingStatus !== 'normal' ? <Meta icon="information-circle-outline" text={OPERATING_LABEL[place.operatingStatus]} /> : null}
            </View>
            <Text style={type.caption}>{originLabel}から直線距離</Text>
          </View>

          <View style={styles.badges}>
            <Badge info={baseBadge(base)} size="sm" />
            {profile ? <Badge info={fitBadge(fit.result)} size="sm" /> : <Badge info={{ tone: 'neutral', label: '犬の条件は未登録' }} size="sm" />}
          </View>

          <View style={styles.facts}>
            <Fact icon="paw-outline" label="犬と過ごせる区画" value={zoneSummary(place.zone)} />
            <Fact icon="shield-checkmark-outline" label="犬の条件" value={dogConditionSummary(place.zone)} />
            <Fact icon="receipt-outline" label="利用条件" value={usageSummary(place.usage)} />
          </View>

          {place.atmosphereTags.length ? (
            <View style={styles.tags} accessibilityLabel={`雰囲気：${place.atmosphereTags.join('、')}`}>
              {place.atmosphereTags.slice(0, 4).map((t) => (
                <Tag key={t} label={t} />
              ))}
            </View>
          ) : null}

          <View style={styles.footer}>
            <View style={styles.footerItem} accessible accessibilityLabel={avail.label}>
              <Icon name="time-outline" size={14} color={avail.tone === 'ok' ? colors.ok : avail.tone === 'warn' ? colors.warn : colors.textMuted} />
              <Text style={[styles.footerText, avail.tone === 'ok' && { color: colors.ok }, avail.tone === 'warn' && { color: colors.warn }]}>{avail.label}</Text>
            </View>
            <View style={styles.footerItem} accessible accessibilityLabel={fresh.label}>
              <Icon name="checkmark-done-outline" size={14} color={fresh.tone === 'warn' ? colors.warn : colors.textMuted} />
              <Text style={[styles.footerText, fresh.tone === 'warn' && { color: colors.warn }]} numberOfLines={1}>
                {fresh.label}
              </Text>
            </View>
            <View style={styles.footerItem}>
              <Icon name="chatbubble-ellipses-outline" size={14} color={colors.textMuted} />
              <Text style={styles.footerText}>口コミ {counts?.reviewCount ?? 0}</Text>
              <Icon name="camera-outline" size={14} color={colors.textMuted} style={{ marginLeft: 6 }} />
              <Text style={styles.footerText}>犬の写真 {counts?.photoCount ?? 0}</Text>
            </View>
            {place.reservationUrl ? (
              <View style={styles.footerItem}>
                <Icon name="calendar-outline" size={14} color={colors.primary} />
                <Text style={[styles.footerText, { color: colors.primary }]}>予約ページあり</Text>
              </View>
            ) : null}
          </View>
        </View>
      </Pressable>
      <View style={styles.saveSlot}>
        <IconButton
          icon={saved ? 'heart' : 'heart-outline'}
          color={saved ? colors.heart : colors.text}
          label={saved ? `${place.name}は保存済み。タップで保存を解除` : `${place.name}を保存する`}
          onPress={onSave}
          size={40}
          style={shadow.raised}
        />
      </View>
    </View>
  );
}

function Meta({ icon, text, strong }: { icon: IconName; text: string; strong?: boolean }) {
  return (
    <View style={styles.meta}>
      <Icon name={icon} size={14} color={strong ? colors.primary : colors.textMuted} />
      <Text style={[styles.metaText, strong && { color: colors.primaryInk, fontWeight: '700' }]}>{text}</Text>
    </View>
  );
}

function Fact({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <View style={styles.fact} accessible accessibilityLabel={`${label}：${value}`}>
      <Icon name={icon} size={15} color={colors.primary} style={{ marginTop: 2 }} />
      <Text style={styles.factText} numberOfLines={2}>
        <Text style={styles.factLabel}>{label}　</Text>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    marginHorizontal: space.lg,
    marginBottom: space.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  saveSlot: { position: 'absolute', top: 10, right: 10 },
  body: { padding: space.lg, paddingTop: space.md, gap: space.md },
  name: { fontSize: 18, lineHeight: 25, fontWeight: '800', color: colors.text },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.md, rowGap: 2 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  facts: { gap: 6, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: space.md },
  fact: { flexDirection: 'row', gap: 8 },
  factText: { flex: 1, fontSize: 13.5, lineHeight: 20, color: colors.text },
  factLabel: { fontWeight: '700', color: colors.textMuted },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  footer: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.md, rowGap: 6, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border, paddingTop: space.md },
  footerItem: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: '100%' },
  footerText: { fontSize: 12.5, color: colors.textMuted, fontWeight: '600', flexShrink: 1 },
});
