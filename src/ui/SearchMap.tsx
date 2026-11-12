import Constants, { ExecutionEnvironment } from 'expo-constants';
import { router } from 'expo-router';
import React, { useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import MapView, { Circle, Marker, type Region } from 'react-native-maps';
import type { LatLng } from '@/domain/geo';
import { toMapMarkers, type SearchOrigin, type SearchResult } from '@/domain/search';
import { Button } from './components';
import { MapUnavailable } from './MapUnavailable';
import { colors, space } from './theme';

export interface SearchMapProps {
  results: SearchResult[];
  origin: SearchOrigin;
  radiusKm: number;
  onSearchHere: (center: LatLng) => void;
}

/** Android の開発ビルド・本番ビルドで Google Maps のキーが未設定なら、地図の代わりに説明を出す */
function nativeMapAvailable(): { ok: true } | { ok: false; reason: string } {
  if (Platform.OS === 'android') {
    const inExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
    const configured = !!Constants.expoConfig?.extra?.androidMapsConfigured;
    if (!inExpoGo && !configured) return { ok: false, reason: 'この端末では地図を表示できません。一覧からお探しください。' };
  }
  return { ok: true };
}

export function SearchMap({ results, origin, radiusKm, onSearchHere }: SearchMapProps) {
  const availability = nativeMapAvailable();
  const markers = useMemo(() => toMapMarkers(results), [results]);
  const initialRegion: Region = useMemo(
    () => ({ latitude: origin.lat, longitude: origin.lng, latitudeDelta: (radiusKm / 111) * 2.4, longitudeDelta: (radiusKm / 91) * 2.4 }),
    // 基準点が変わったときだけ初期位置を変える
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [origin.lat, origin.lng],
  );
  const [moved, setMoved] = useState<LatLng | null>(null);
  const mapRef = useRef<MapView>(null);

  if (!availability.ok) return <MapUnavailable reason={availability.reason} />;

  return (
    <View style={{ flex: 1 }}>
      <MapView
        key={`${origin.lat},${origin.lng}`}
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        showsUserLocation={false}
        onRegionChangeComplete={(r, details) => {
          // 利用者の操作で動いたときだけ「この範囲で検索」を出す（基準点は勝手に変えない）
          if (details?.isGesture === false) return;
          const d = Math.abs(r.latitude - origin.lat) + Math.abs(r.longitude - origin.lng);
          setMoved(d > 0.002 ? { lat: r.latitude, lng: r.longitude } : null);
        }}
        accessibilityLabel={`地図。基準点は${origin.label}。${markers.length}件を表示`}
      >
        <Marker
          coordinate={{ latitude: origin.lat, longitude: origin.lng }}
          title={`検索の基準点：${origin.label}`}
          pinColor="#4A5A56"
        />
        <Circle
          center={{ latitude: origin.lat, longitude: origin.lng }}
          radius={radiusKm * 1000}
          strokeColor={colors.primary}
          fillColor="rgba(15,118,110,0.06)"
        />
        {markers.map((m) => (
          <Marker
            key={m.id}
            coordinate={{ latitude: m.lat, longitude: m.lng }}
            title={m.title}
            description="タップで詳細"
            pinColor={colors.primary}
            onCalloutPress={() => router.push(`/place/${m.id}`)}
          />
        ))}
      </MapView>
      {moved ? (
        <View style={styles.searchHere}>
          <Button
            label="この範囲で検索"
            onPress={() => {
              onSearchHere(moved);
              setMoved(null);
            }}
            accessibilityHint="地図の中心を新しい検索の基準点にします"
          />
        </View>
      ) : null}
      <View style={styles.legend} pointerEvents="none">
        <Text style={styles.legendText}>灰色のピン：検索の基準点 ／ 緑のピン：施設（{markers.length}件）</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  searchHere: { position: 'absolute', top: space.md, alignSelf: 'center' },
  legend: {
    position: 'absolute',
    bottom: space.sm,
    left: space.sm,
    right: space.sm,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 8,
    padding: space.sm,
  },
  legendText: { fontSize: 13, color: colors.text },
});
