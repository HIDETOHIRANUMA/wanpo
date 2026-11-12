import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  dailyPeak,
  HEAT_DOG_ADVICE,
  HEAT_LEVEL_LABEL,
  HEAT_SOURCE_LABEL,
  heatLevel,
  hourlyForDay,
  riskyWindows,
  wbgtAt,
  type HeatForecast,
  type HeatLevel,
} from '@/domain/heat';
import { formatMinute, toJst } from '@/domain/hours';
import { Icon, type IconName } from './components';
import { colors, radius, space, type } from './theme';
import type { HeatState } from './useHeat';

/** 区分の色（環境省の配色に近い順番。文字は必ずラベルと併用する） */
export const HEAT_COLORS: Record<HeatLevel, { fill: string; soft: string; ink: string }> = {
  safe: { fill: '#3D8FE0', soft: '#E6F1FC', ink: '#1A5590' },
  caution: { fill: '#79C0F2', soft: '#EAF6FD', ink: '#1F5F86' },
  warning: { fill: '#E9C400', soft: '#FFF8D6', ink: '#6E5A00' },
  severe: { fill: '#F08A1C', soft: '#FFEEDB', ink: '#8A4300' },
  danger: { fill: '#E0342A', soft: '#FDE8E6', ink: '#A0201A' },
};

const HEAT_ICON: Record<HeatLevel, IconName> = {
  safe: 'happy-outline',
  caution: 'water-outline',
  warning: 'sunny-outline',
  severe: 'warning-outline',
  danger: 'alert-circle',
};

export function HeatBadge({ wbgt, size = 'md' }: { wbgt: number; size?: 'sm' | 'md' }) {
  const lv = heatLevel(wbgt);
  const c = HEAT_COLORS[lv];
  return (
    <View
      style={[styles.badge, { backgroundColor: c.soft, borderColor: c.fill }, size === 'sm' && { paddingVertical: 2, paddingHorizontal: 6 }]}
      accessible
      accessibilityLabel={`暑さ指数${Math.round(wbgt)}、${HEAT_LEVEL_LABEL[lv]}`}
    >
      <Icon name={HEAT_ICON[lv]} size={size === 'sm' ? 12 : 14} color={c.ink} />
      <Text style={[styles.badgeText, { color: c.ink }, size === 'sm' && { fontSize: 11.5 }]}>
        {Math.round(wbgt)} {HEAT_LEVEL_LABEL[lv]}
      </Text>
    </View>
  );
}

/** 0〜24時の帯。色の帯と「いま」の印 */
export function HeatStrip({ forecast, now, height = 14 }: { forecast: HeatForecast; now: Date; height?: number }) {
  const hours = hourlyForDay(forecast, now);
  const nowMin = toJst(now).minute;
  return (
    <View accessible accessibilityLabel={stripLabel(forecast, now)}>
      <View style={[styles.strip, { height }]}>
        {hours.map((v, h) => (
          <View key={h} style={{ flex: 1, backgroundColor: v === null ? colors.border : HEAT_COLORS[heatLevel(v)].fill }} />
        ))}
        <View style={[styles.nowMark, { left: `${(nowMin / 1440) * 100}%`, height: height + 8 }]} />
      </View>
      <View style={styles.stripLabels}>
        {['0', '6', '12', '18', '24時'].map((t) => (
          <Text key={t} style={styles.stripLabel}>
            {t}
          </Text>
        ))}
      </View>
    </View>
  );
}

function stripLabel(f: HeatForecast, now: Date): string {
  const w = riskyWindows(f, now, 'severe');
  return w.length ? `今日の厳重警戒以上の時間帯：${w.map((x) => `${formatMinute(x.startMin)}から${formatMinute(x.endMin)}`).join('、')}` : '今日は厳重警戒以上の時間帯はありません';
}

export function windowsText(f: HeatForecast, now: Date): string | null {
  const w = riskyWindows(f, now, 'severe');
  if (!w.length) return null;
  return w.map((x) => `${x.startMin / 60}〜${x.endMin / 60}時`).join('・');
}

const UNAVAILABLE_TEXT = {
  off_season: '暑さ指数の提供期間外です（環境省の提供は例年4月下旬〜10月）',
  not_configured: '暑さ指数は準備中です',
  no_point: 'この地域の暑さ指数はありません',
} as const;

/** 探す画面などに出す「今日の暑さ」 */
export function HeatCard({ state, now, placeLabel }: { state: HeatState; now: Date; placeLabel: string }) {
  if (state.status === 'loading') {
    return (
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <Text style={type.small}>暑さ指数を確認しています…</Text>
      </View>
    );
  }
  if (state.status !== 'ok') {
    return (
      <View style={[styles.card, { backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: space.sm }]}>
        <Icon name="thermometer-outline" size={18} color={colors.textMuted} />
        <Text style={[type.small, { flex: 1 }]}>
          {state.status === 'error' ? '暑さ指数を取得できませんでした。' : UNAVAILABLE_TEXT[state.reason]}
          {'\n'}暑い日は、水を持ってこまめに休憩しましょう。
        </Text>
      </View>
    );
  }
  const f = state.forecast;
  const cur = wbgtAt(f, now);
  const peak = dailyPeak(f, now);
  const lv = cur !== null ? heatLevel(cur) : peak ? heatLevel(peak.wbgt) : 'safe';
  const c = HEAT_COLORS[lv];
  const windows = windowsText(f, now);
  return (
    <View style={[styles.card, { backgroundColor: c.soft, borderColor: c.fill }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <View style={[styles.bigIcon, { backgroundColor: c.fill }]}>
          <Icon name={HEAT_ICON[lv]} size={24} color={colors.white} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[type.overline, { color: c.ink }]}>いまの暑さ指数（{placeLabel}付近）</Text>
          <Text style={[styles.level, { color: c.ink }]}>
            {cur !== null ? `${Math.round(cur)}　${HEAT_LEVEL_LABEL[lv]}` : '現在の値なし'}
          </Text>
          <Text style={[type.small, { color: c.ink }]}>{HEAT_DOG_ADVICE[lv]}</Text>
        </View>
      </View>
      <HeatStrip forecast={f} now={now} />
      <Text style={[type.small, { color: c.ink }]}>
        {windows ? `今日の厳重警戒以上：${windows}` : peak ? `今日の最高：${Math.round(peak.wbgt)}（${peak.hour}時ごろ）` : ''}
        。犬は地面に近く熱を受けやすいので、人の目安より1段階きびしめに考えましょう。
      </Text>
      <Text style={[type.caption, { color: c.ink }]}>
        {HEAT_SOURCE_LABEL[f.source]}
        {f.source === 'env_go_jp' ? `・観測地点：${f.pointName}` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: radius.pill, paddingVertical: 3, paddingHorizontal: 8, alignSelf: 'flex-start' },
  badgeText: { fontSize: 12.5, fontWeight: '700' },
  card: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: space.md, gap: space.sm },
  bigIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  level: { fontSize: 20, lineHeight: 26, fontWeight: '800' },
  strip: { flexDirection: 'row', borderRadius: 4, overflow: 'visible', marginTop: 4 },
  nowMark: { position: 'absolute', top: -4, width: 3, marginLeft: -1.5, backgroundColor: colors.text, borderRadius: 2 },
  stripLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 3 },
  stripLabel: { fontSize: 10.5, color: colors.textMuted },
});
