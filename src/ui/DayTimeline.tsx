import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { HEAT_SOURCE_LABEL, riskyWindows, type HeatForecast } from '@/domain/heat';
import { daySegments, dogDaySegments, formatMinute, intersectSegments, toJst, type DaySegment } from '@/domain/hours';
import type { Place } from '@/domain/types';
import { HeatStrip } from './Heat';
import { colors, radius, space, type } from './theme';

function segText(segs: DaySegment[]): string {
  return segs.map((s) => `${formatMinute(s.startMin)}〜${formatMinute(s.endMin)}`).join('、');
}

/**
 * 1日のタイムライン：営業時間・犬と過ごせる時間・暑さ指数を同じ時間軸に重ねる。
 * 「今日は何時に行けば入れて、暑い時間をここで過ごせるか」をひと目で分かるようにする。
 */
export function DayTimeline({ place, now, forecast }: { place: Place; now: Date; forecast: HeatForecast | null }) {
  const closedToday = place.operatingStatus === 'closed' || place.operatingStatus === 'temporarily_closed';
  const biz = closedToday ? [] : daySegments(place.businessHours, now);
  const dog = closedToday ? [] : dogDaySegments(place, now);
  const nowMin = toJst(now).minute;
  const hot = forecast ? riskyWindows(forecast, now, 'severe').map((w) => ({ startMin: w.startMin, endMin: w.endMin })) : [];
  const shelter = dog && hot.length ? intersectSegments(dog, hot) : [];

  return (
    <View style={{ gap: space.md }}>
      <Row label="営業" segs={biz} color={colors.borderStrong} nowMin={nowMin} />
      <Row label="犬と過ごせる" segs={dog} color={colors.primary} nowMin={nowMin} />
      {forecast ? (
        <View style={styles.row}>
          <Text style={styles.rowLabel}>暑さ指数</Text>
          <View style={{ flex: 1 }}>
            <HeatStrip forecast={forecast} now={now} height={12} />
            <Text style={[type.caption, { marginTop: 2 }]}>{HEAT_SOURCE_LABEL[forecast.source]}</Text>
          </View>
        </View>
      ) : null}
      <View style={styles.summary}>
        {dog === null ? (
          <Text style={type.small}>犬と過ごせる時間が未確認のため、行く前にお店へ確認してください。</Text>
        ) : dog.length === 0 ? (
          <Text style={type.small}>今日は犬と過ごせる時間がありません（休業日・時間外）。</Text>
        ) : (
          <Text style={type.small}>
            今日、犬と過ごせるのは <Text style={styles.em}>{segText(dog)}</Text>。
            {hot.length
              ? shelter.length
                ? ` 暑さが厳しい時間（${segText(hot)}）のうち、${segText(shelter)}はここで涼めます。`
                : ` 暑さが厳しい時間（${segText(hot)}）は開いていません。`
              : ''}
          </Text>
        )}
      </View>
    </View>
  );
}

function Row({ label, segs, color, nowMin }: { label: string; segs: DaySegment[] | null; color: string; nowMin: number }) {
  return (
    <View style={styles.row} accessible accessibilityLabel={`${label}：${segs === null ? '未確認' : segs.length ? segText(segs) : 'なし'}`}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={{ flex: 1 }}>
        <View style={styles.track}>
          {segs === null ? <View style={[StyleSheet.absoluteFill, styles.unknown]} /> : null}
          {(segs ?? []).map((s, i) => (
            <View key={i} style={[styles.seg, { left: `${(s.startMin / 1440) * 100}%`, width: `${((s.endMin - s.startMin) / 1440) * 100}%`, backgroundColor: color }]} />
          ))}
          <View style={[styles.now, { left: `${(nowMin / 1440) * 100}%` }]} />
        </View>
        {segs === null ? <Text style={[type.caption, { marginTop: 2 }]}>未確認</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  rowLabel: { width: 84, fontSize: 12.5, fontWeight: '700', color: colors.textMuted },
  track: { height: 14, borderRadius: 4, backgroundColor: colors.surfaceAlt, overflow: 'visible' },
  seg: { position: 'absolute', top: 0, bottom: 0, borderRadius: 4 },
  unknown: { borderRadius: 4, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.borderStrong, backgroundColor: 'transparent' },
  now: { position: 'absolute', top: -4, bottom: -4, width: 3, marginLeft: -1.5, backgroundColor: colors.text, borderRadius: 2 },
  summary: { backgroundColor: colors.primarySoft, borderRadius: radius.md, padding: space.md },
  em: { fontWeight: '800', color: colors.primaryInk },
});
