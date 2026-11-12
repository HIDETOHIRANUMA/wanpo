import React, { useMemo } from 'react';
import { Text, View } from 'react-native';
import { coverageCircles, coverageRatio } from '@/domain/cool';
import { CoolMapDiagram } from './CoolMapDiagram';
import type { SearchMapProps } from './SearchMap';
import { colors, space, type } from './theme';

/** Web ではネイティブ地図を使えないため、涼しさの簡易マップ（道路のない位置関係の図）を出す */
export function SearchMap({ results, origin, radiusKm }: SearchMapProps) {
  const circles = useMemo(() => coverageCircles(results), [results]);
  const ratio = useMemo(() => coverageRatio(origin, results, radiusKm), [origin, results, radiusKm]);
  return (
    <View style={{ flex: 1, padding: space.lg, gap: space.sm, backgroundColor: colors.bg }}>
      <Text style={type.heading}>涼しさの地図（簡易表示）</Text>
      <Text style={type.small}>
        {origin.label}から{radiusKm}km以内のうち、徒歩10分以内に涼める場所があるのは約{Math.round(ratio * 100)}%です。色のない場所は、近くに涼める場所がない地域です。
      </Text>
      <CoolMapDiagram origin={origin} radiusKm={radiusKm} circles={circles} height={360} />
      <Text style={type.caption}>道路や建物は表示していません。点線の円は営業時間外・未確認の場所です。点をタップすると詳細を開きます。</Text>
    </View>
  );
}
