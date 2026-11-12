import { router, Stack } from 'expo-router';
import React, { useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { coolNow, walkMinutes } from '@/domain/cool';
import { formatDistance } from '@/domain/geo';
import { HEAT_SOURCE_LABEL, wbgtAt } from '@/domain/heat';
import { CATEGORY_LABEL } from '@/domain/labels';
import type { SearchOrigin, SearchResult } from '@/domain/search';
import { useApp } from '@/state/AppContext';
import { getSessionOrigin, setSessionOrigin } from '@/state/searchSession';
import { contactActions } from '@/ui/contactPolicy';
import { Badge, Button, CATEGORY_ICON, DemoBanner, EmptyState, ErrorState, Icon, Loading, Notice } from '@/ui/components';
import { errorMessage } from '@/ui/errors';
import { HeatBadge } from '@/ui/Heat';
import { getCurrentLocationOnce, LOCATION_FAILURE_MESSAGE } from '@/ui/location';
import { fitBadge } from '@/ui/status';
import { colors, radius, shadow, space, type } from '@/ui/theme';
import { useHeat } from '@/ui/useHeat';
import { useNearbyResults } from '@/ui/useNearbyResults';

/**
 * いますぐ涼みたい：散歩中に犬がバテたとき用。
 * 片手で押せる大きなボタンで、いちばん近い「いま開いている涼める場所」を1つだけ大きく出す。
 */
export default function CoolNowScreen() {
  const { isDemo } = useApp();
  const [origin, setOrigin] = useState<SearchOrigin>(getSessionOrigin);
  const [now] = useState(() => new Date());
  const [locBusy, setLocBusy] = useState(false);
  const [locMessage, setLocMessage] = useState<string | null>(null);
  const { loading, error, results, retry } = useNearbyResults(origin, 3, now);
  const heat = useHeat(origin);
  const cur = heat.status === 'ok' ? wbgtAt(heat.forecast, now) : null;
  const pick = coolNow(results);

  const useLocation = async () => {
    setLocBusy(true);
    setLocMessage(null);
    const r = await getCurrentLocationOnce();
    setLocBusy(false);
    if (r.ok) {
      const o: SearchOrigin = { kind: 'current_location', label: '現在地', ...r.coords };
      setOrigin(o);
      setSessionOrigin(o);
    } else setLocMessage(LOCATION_FAILURE_MESSAGE[r.reason]);
  };

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: 48 }}>
      <Stack.Screen options={{ title: 'いますぐ涼みたい' }} />
      {isDemo ? <DemoBanner /> : null}

      <View style={styles.originRow}>
        <Icon name={origin.kind === 'current_location' ? 'navigate' : 'location'} size={18} color={colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={type.overline}>ここから探しています</Text>
          <Text style={type.label} numberOfLines={1}>
            {origin.label}
          </Text>
        </View>
        {cur !== null ? <HeatBadge wbgt={cur} size="sm" /> : null}
      </View>
      {cur !== null && heat.status === 'ok' ? <Text style={type.caption}>暑さ指数：{HEAT_SOURCE_LABEL[heat.forecast.source]}</Text> : null}
      {origin.kind !== 'current_location' ? (
        <View style={{ gap: space.xs }}>
          <Button label={locBusy ? '現在地を取得中…' : '現在地から探す'} icon="navigate" variant="secondary" size="lg" onPress={useLocation} loading={locBusy} />
          <Text style={type.caption}>今回だけ現在地を取得し、近い順の計算にだけ使います（保存・送信しません）。</Text>
        </View>
      ) : null}
      {locMessage ? <Notice tone="warn" title={locMessage} /> : null}

      {loading ? (
        <Loading label="近くの涼める場所を探しています…" />
      ) : error ? (
        <ErrorState message={errorMessage(error, '施設情報を読み込めませんでした。')} onRetry={retry} />
      ) : pick.best ? (
        <>
          <BestCard r={pick.best} isDemo={isDemo} />
          {pick.alternatives.length ? <Text style={[type.heading, { marginTop: space.sm }]}>ほかの候補</Text> : null}
          {pick.alternatives.map((r) => (
            <SmallRow key={r.place.id} r={r} />
          ))}
        </>
      ) : (
        <EmptyState
          icon="snow-outline"
          title="3km以内に、いま開いている涼める場所が見つかりません"
          body="日陰で休ませ、水を飲ませてください。ぐったりしている、呼吸が荒いなどの様子があれば、すぐに動物病院へ連絡してください。"
          tone="warn"
        />
      )}

      {!loading && !error && pick.unknownHours.length ? (
        <>
          <Text style={[type.heading, { marginTop: space.sm }]}>営業時間が未確認の候補</Text>
          {pick.unknownHours.map((r) => (
            <SmallRow key={r.place.id} r={r} />
          ))}
        </>
      ) : null}

      <Notice
        tone="info"
        icon="medkit-outline"
        title="熱中症が疑われるときは"
        body="涼しい場所へ移し、首・わき・内ももを水でぬらしたタオルで冷やし、動物病院へ連絡してください。この画面の情報は営業時間上の目安で、当日の入店を保証するものではありません。"
      />
    </ScrollView>
  );
}

function BestCard({ r, isDemo }: { r: SearchResult; isDemo: boolean }) {
  const platform = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';
  const actions = contactActions(r.place, { isDemoMode: isDemo, source: 'live', platform });
  const min = walkMinutes(r.distanceKm);
  return (
    <View style={styles.best}>
      <Text style={[type.overline, { color: colors.primaryInk }]}>いちばん近い涼める場所</Text>
      <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
        <View style={styles.bestIcon}>
          <Icon name={CATEGORY_ICON[r.place.category]} size={26} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.bestName} numberOfLines={2}>
            {r.place.name}
          </Text>
          <Text style={type.small}>{CATEGORY_LABEL[r.place.category]}・営業時間上は営業中</Text>
        </View>
      </View>
      <View style={styles.walk} accessible accessibilityLabel={`徒歩約${min}分、直線${formatDistance(r.distanceKm)}`}>
        <Icon name="walk" size={28} color={colors.white} />
        <Text style={styles.walkMin}>徒歩 約{min}分</Text>
        <Text style={styles.walkKm}>直線{formatDistance(r.distanceKm)}</Text>
      </View>
      <Badge info={fitBadge(r.fit.result)} />
      <View style={{ gap: space.sm }}>
        <Button
          label="経路を地図アプリで開く"
          icon="navigate"
          size="lg"
          disabled={!actions.directionsUrl}
          disabledReason={actions.blockedReason ?? undefined}
          onPress={() => actions.directionsUrl && Linking.openURL(actions.directionsUrl).catch(() => undefined)}
        />
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Button label="電話" icon="call-outline" variant="secondary" size="lg" style={{ flex: 1 }} disabled={!actions.telUrl} onPress={() => actions.telUrl && Linking.openURL(actions.telUrl).catch(() => undefined)} />
          <Button label="詳細" icon="information-circle-outline" variant="secondary" size="lg" style={{ flex: 1 }} onPress={() => router.push(`/place/${r.place.id}`)} />
        </View>
        {actions.blockedReason ? <Text style={type.caption}>{actions.blockedReason}</Text> : null}
      </View>
    </View>
  );
}

function SmallRow({ r }: { r: SearchResult }) {
  return (
    <Pressable
      onPress={() => router.push(`/place/${r.place.id}`)}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
      accessibilityRole="button"
      accessibilityLabel={`${r.place.name}、徒歩約${walkMinutes(r.distanceKm)}分。詳細を見る`}
    >
      <Icon name={CATEGORY_ICON[r.place.category]} size={22} color={colors.primary} />
      <View style={{ flex: 1 }}>
        <Text style={type.label} numberOfLines={1}>
          {r.place.name}
        </Text>
        <Text style={type.caption}>
          徒歩約{walkMinutes(r.distanceKm)}分・直線{formatDistance(r.distanceKm)}
        </Text>
      </View>
      <Icon name="chevron-forward" size={18} color={colors.textSubtle} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  originRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: colors.surface, borderRadius: radius.md, padding: space.md, borderWidth: 1, borderColor: colors.border },
  best: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: space.lg, gap: space.md, borderWidth: 2, borderColor: colors.primary, ...shadow.raised },
  bestIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  bestName: { fontSize: 21, lineHeight: 28, fontWeight: '800', color: colors.text },
  walk: { flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: colors.primary, borderRadius: radius.lg, paddingVertical: space.md, paddingHorizontal: space.lg },
  walkMin: { fontSize: 26, fontWeight: '800', color: colors.white, flex: 1 },
  walkKm: { fontSize: 14, fontWeight: '600', color: colors.white, opacity: 0.9 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.surface, borderRadius: radius.md, padding: space.md, minHeight: 60, borderWidth: 1, borderColor: colors.border },
});
