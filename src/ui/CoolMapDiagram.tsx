import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import type { CoverageCircle } from '@/domain/cool';
import type { LatLng } from '@/domain/geo';
import { colors, radius, space, type } from './theme';

/**
 * 地図アプリを使わない「簡易マップ」。基準点を中心に、涼める場所の徒歩圏を円で描く。
 * 円がない場所＝近くに涼める場所がない地域。道路や建物は描かない（位置関係の目安）。
 */
export function CoolMapDiagram({
  origin,
  radiusKm,
  circles,
  route,
  height = 300,
  showCircles = true,
}: {
  origin: LatLng;
  radiusKm: number;
  circles: CoverageCircle[];
  /** お散歩プランの道順（出発 → 休憩先 → 出発） */
  route?: LatLng[];
  height?: number;
  showCircles?: boolean;
}) {
  const [w, setW] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);
  const size = Math.min(w, height);
  const kmLng = 111 * Math.cos((origin.lat * Math.PI) / 180);
  const scale = size / 2 / radiusKm; // px / km
  const px = (p: LatLng) => ({
    x: w / 2 + (p.lng - origin.lng) * kmLng * scale,
    y: height / 2 - (p.lat - origin.lat) * 111 * scale,
  });

  return (
    <View style={[styles.box, { height }]} onLayout={onLayout} accessible accessibilityLabel={`簡易マップ。涼める場所${circles.length}か所の徒歩圏を表示`}>
      {w > 0 ? (
        <>
          {/* 検索範囲 */}
          <View
            style={[
              styles.range,
              { width: size, height: size, borderRadius: size / 2, left: w / 2 - size / 2, top: height / 2 - size / 2 },
            ]}
          />
          {showCircles
            ? circles.map((c) => {
                const p = px(c);
                const r = c.radiusKm * scale;
                return (
                  <View
                    key={`c-${c.id}`}
                    style={[
                      styles.reach,
                      { width: r * 2, height: r * 2, borderRadius: r, left: p.x - r, top: p.y - r },
                      !c.open && { backgroundColor: 'rgba(11,122,112,0.10)', borderStyle: 'dashed' },
                    ]}
                  />
                );
              })
            : null}
          {route && route.length > 1
            ? route.slice(1).map((b, i) => {
                const a = px(route[i]);
                const q = px(b);
                const len = Math.hypot(q.x - a.x, q.y - a.y);
                const ang = Math.atan2(q.y - a.y, q.x - a.x);
                return (
                  <View
                    key={`l-${i}`}
                    style={[
                      styles.line,
                      { width: len, left: (a.x + q.x) / 2 - len / 2, top: (a.y + q.y) / 2 - 2, transform: [{ rotate: `${ang}rad` }] },
                    ]}
                  />
                );
              })
            : null}
          {circles.map((c) => {
            const p = px(c);
            return (
              <Pressable
                key={`d-${c.id}`}
                onPress={() => router.push(`/place/${c.id}`)}
                hitSlop={10}
                style={[styles.dot, { left: p.x - 8, top: p.y - 8 }, !c.open && { backgroundColor: colors.surface }]}
                accessibilityRole="button"
                accessibilityLabel="涼める場所。タップで詳細"
              />
            );
          })}
          {route && route.length > 2
            ? route.slice(1, -1).map((s, i) => {
                const p = px(s);
                return (
                  <View key={`n-${i}`} style={[styles.num, { left: p.x - 11, top: p.y - 11 }]} pointerEvents="none">
                    <Text style={styles.numText}>{i + 1}</Text>
                  </View>
                );
              })
            : null}
          <View style={[styles.origin, { left: w / 2 - 9, top: height / 2 - 9 }]} pointerEvents="none" />
        </>
      ) : null}
      <View style={styles.legend} pointerEvents="none">
        <Legend color={colors.primary} label="涼める場所" />
        {showCircles ? <Legend color="rgba(11,122,112,0.28)" label="徒歩10分圏" /> : null}
        <Legend color={colors.text} label="基準点" />
      </View>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
      <Text style={type.caption}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: '#FBF3EA', borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  range: { position: 'absolute', borderWidth: 1, borderColor: colors.borderStrong, borderStyle: 'dashed', backgroundColor: '#FFF8F0' },
  reach: { position: 'absolute', backgroundColor: 'rgba(11,122,112,0.20)', borderWidth: 1, borderColor: 'rgba(11,122,112,0.45)' },
  dot: { position: 'absolute', width: 16, height: 16, borderRadius: 8, backgroundColor: colors.primary, borderWidth: 2, borderColor: colors.white },
  origin: { position: 'absolute', width: 18, height: 18, borderRadius: 9, backgroundColor: colors.text, borderWidth: 3, borderColor: colors.white },
  line: { position: 'absolute', height: 4, borderRadius: 2, backgroundColor: colors.accent },
  num: { position: 'absolute', width: 22, height: 22, borderRadius: 11, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.white },
  numText: { color: colors.white, fontSize: 11, fontWeight: '800' },
  legend: { position: 'absolute', left: space.sm, bottom: space.sm, flexDirection: 'row', gap: space.md, backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: radius.sm, paddingHorizontal: space.sm, paddingVertical: 4 },
});
