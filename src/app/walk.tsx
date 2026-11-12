import { router, Stack } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { coverageCircles, planWalk, reachKm, type WalkPlan } from '@/domain/cool';
import { formatDistance } from '@/domain/geo';
import { formatMinute, toJst } from '@/domain/hours';
import type { RadiusKm, SearchOrigin } from '@/domain/search';
import { useApp } from '@/state/AppContext';
import { getSessionOrigin, setSessionOrigin } from '@/state/searchSession';
import { Button, Card, DemoBanner, ErrorState, Icon, Loading, Notice, Section, Segmented } from '@/ui/components';
import { CoolMapDiagram } from '@/ui/CoolMapDiagram';
import { errorMessage } from '@/ui/errors';
import { HeatBadge, HeatStrip } from '@/ui/Heat';
import { HEAT_SOURCE_LABEL } from '@/domain/heat';
import { getCurrentLocationOnce, LOCATION_FAILURE_MESSAGE } from '@/ui/location';
import { colors, radius, space, type } from '@/ui/theme';
import { useHeat } from '@/ui/useHeat';
import { useNearbyResults } from '@/ui/useNearbyResults';

type StartKey = 'now' | '6' | '7' | '18' | '19';
const START_OPTIONS: { value: StartKey; label: string }[] = [
  { value: 'now', label: 'いまから' },
  { value: '6', label: '朝6時' },
  { value: '7', label: '朝7時' },
  { value: '18', label: '18時' },
  { value: '19', label: '19時' },
];

/** 出発時刻（JST）。過ぎた時刻は翌日 */
function startAt(key: StartKey, now: Date): Date {
  if (key === 'now') return now;
  const { date, minute } = toJst(now);
  const h = Number(key);
  const t = Date.parse(`${date}T${String(h).padStart(2, '0')}:00:00+09:00`);
  return new Date(minute >= h * 60 ? t + 86_400_000 : t);
}

/**
 * お散歩プラン：出発地点から、涼める場所に立ち寄って戻ってくる道のりを作る。
 * 距離は直線距離からの目安。暑い区間・休憩の間隔が長い区間に注意を出す。
 */
export default function WalkPlanScreen() {
  const { isDemo } = useApp();
  const [origin, setOrigin] = useState<SearchOrigin>(getSessionOrigin);
  const [now] = useState(() => new Date());
  const [startKey, setStartKey] = useState<StartKey>('now');
  const [duration, setDuration] = useState('60');
  const [rest, setRest] = useState('15');
  const [locBusy, setLocBusy] = useState(false);
  const [locMessage, setLocMessage] = useState<string | null>(null);

  const durationMin = Number(duration);
  const restMin = Number(rest);
  // 往復できる範囲だけ取得する（片道＝散歩時間の半分）
  const radiusKm: RadiusKm = reachKm(durationMin / 2) <= 1 ? 1 : reachKm(durationMin / 2) <= 3 ? 3 : 5;
  const { loading, error, results, retry } = useNearbyResults(origin, radiusKm, now);
  const heat = useHeat(origin);
  const forecast = heat.status === 'ok' ? heat.forecast : null;
  const start = startAt(startKey, now);

  const plan: WalkPlan | null = useMemo(
    () => (loading || error ? null : planWalk({ origin, start, durationMin, restMin, results, forecast })),
    // start は startKey と now から決まる
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loading, error, origin, startKey, durationMin, restMin, results, forecast],
  );

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

  const route = plan && plan.stops.length ? [origin, ...plan.stops.map((s) => s.result.place), origin] : undefined;

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: space.lg, paddingBottom: 48 }}>
      <Stack.Screen options={{ title: 'お散歩プラン' }} />
      {isDemo ? <DemoBanner /> : null}
      <Text style={type.small}>涼める場所で休憩しながら歩く道のりを作ります。距離は直線距離からの目安で、実際の道順は地図アプリで確認してください。</Text>

      <Section title="出発地点" icon="flag-outline">
        <Card style={{ gap: space.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <Icon name={origin.kind === 'current_location' ? 'navigate' : 'location'} size={18} color={colors.primary} />
            <Text style={[type.label, { flex: 1 }]} numberOfLines={1}>
              {origin.label}
            </Text>
          </View>
          {origin.kind !== 'current_location' ? (
            <Button label={locBusy ? '取得中…' : '現在地を出発地点にする'} icon="navigate" variant="secondary" size="sm" onPress={useLocation} loading={locBusy} />
          ) : null}
          <Text style={type.caption}>出発地点は「探す」画面の基準点です。現在地は今回だけ取得し、保存・送信しません。</Text>
          {locMessage ? <Notice tone="warn" title={locMessage} /> : null}
        </Card>
      </Section>

      <Section title="いつ・どれくらい" icon="time-outline">
        <View style={{ gap: space.sm }}>
          <Segmented value={startKey} onChange={setStartKey} options={START_OPTIONS} />
          <Segmented
            value={duration}
            onChange={setDuration}
            options={[
              { value: '30', label: '30分' },
              { value: '45', label: '45分' },
              { value: '60', label: '60分' },
              { value: '90', label: '90分' },
            ]}
          />
          <Segmented
            value={rest}
            onChange={setRest}
            options={[
              { value: '10', label: '休憩10分' },
              { value: '15', label: '休憩15分' },
              { value: '20', label: '休憩20分' },
            ]}
          />
        </View>
        {forecast ? (
          <View style={{ marginTop: space.md, gap: 4 }}>
            <Text style={type.caption}>今日の暑さ指数（黒い線＝いま）</Text>
            <HeatStrip forecast={forecast} now={now} />
            <Text style={type.caption}>{HEAT_SOURCE_LABEL[forecast.source]}</Text>
          </View>
        ) : null}
      </Section>

      {loading ? (
        <Loading label="立ち寄れる場所を探しています…" />
      ) : error ? (
        <ErrorState message={errorMessage(error, '施設情報を読み込めませんでした。')} onRetry={retry} />
      ) : plan ? (
        <Section title="プラン" icon="map-outline" subtitle={plan.stops.length ? `約${plan.totalMin}分・休憩${plan.stops.length}か所` : undefined}>
          {plan.warnings.map((w) => (
            <Notice key={w} tone="warn" title={w} />
          ))}
          {plan.stops.length ? (
            <>
              <CoolMapDiagram origin={origin} radiusKm={Math.max(0.6, ...plan.stops.map((s) => s.result.distanceKm * 1.25))} circles={coverageCircles(plan.stops.map((s) => s.result))} route={route} height={260} showCircles={false} />
              <View style={styles.timeline}>
                <TimelineRow icon="flag" time={start} title={`出発：${origin.label}`} />
                {plan.stops.map((s, i) => (
                  <React.Fragment key={s.result.place.id}>
                    <LegRow min={s.legMin} km={s.legKm} wbgt={s.legWbgt} />
                    <Pressable onPress={() => router.push(`/place/${s.result.place.id}`)} accessibilityRole="button" accessibilityLabel={`休憩${i + 1}：${s.result.place.name}。詳細を見る`}>
                      <TimelineRow
                        icon="snow"
                        accent
                        number={i + 1}
                        time={s.arriveAt}
                        title={s.result.place.name}
                        note={`${s.availability === 'open' ? '到着時は営業時間内' : '営業時間は未確認'}・${rest}分休憩`}
                        chevron
                      />
                    </Pressable>
                  </React.Fragment>
                ))}
                <LegRow min={plan.back.legMin} km={plan.back.legKm} wbgt={plan.back.legWbgt} />
                <TimelineRow icon="home" time={plan.back.arriveAt} title="出発地点にもどる" last />
              </View>
            </>
          ) : null}
        </Section>
      ) : null}
    </ScrollView>
  );
}

function hhmm(d: Date): string {
  return formatMinute(toJst(d).minute);
}

function TimelineRow({ icon, time, title, note, accent, number, chevron, last }: { icon: 'flag' | 'snow' | 'home'; time: Date; title: string; note?: string; accent?: boolean; number?: number; chevron?: boolean; last?: boolean }) {
  return (
    <View style={[styles.tRow, last && { paddingBottom: 0 }]}>
      <Text style={styles.tTime}>{hhmm(time)}</Text>
      <View style={[styles.tDot, accent && { backgroundColor: colors.accent }]}>
        {number ? <Text style={styles.tNum}>{number}</Text> : <Icon name={icon} size={14} color={colors.white} />}
      </View>
      <View style={[styles.tBody, accent && styles.tBodyAccent]}>
        <Text style={type.label} numberOfLines={2}>
          {title}
        </Text>
        {note ? <Text style={type.caption}>{note}</Text> : null}
      </View>
      {chevron ? <Icon name="chevron-forward" size={16} color={colors.textSubtle} /> : null}
    </View>
  );
}

function LegRow({ min, km, wbgt }: { min: number; km: number; wbgt: number | null }) {
  return (
    <View style={styles.leg}>
      <View style={styles.legLine} />
      <Icon name="walk-outline" size={16} color={colors.textMuted} />
      <Text style={type.small}>
        徒歩 約{min}分（直線{formatDistance(km)}）
      </Text>
      {wbgt !== null ? <HeatBadge wbgt={wbgt} size="sm" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  timeline: { marginTop: space.md, backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.md, borderWidth: 1, borderColor: colors.border },
  tRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 4 },
  tTime: { width: 44, fontSize: 13, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  tDot: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  tNum: { color: colors.white, fontWeight: '800', fontSize: 12 },
  tBody: { flex: 1, paddingVertical: 6 },
  tBodyAccent: { backgroundColor: colors.accentSoft, borderRadius: radius.sm, paddingHorizontal: space.sm },
  leg: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 52 + 13 - 1, paddingLeft: space.md, minHeight: 34, flexWrap: 'wrap' },
  legLine: { position: 'absolute', left: -1, top: 0, bottom: 0, width: 2, backgroundColor: colors.borderStrong },
});
