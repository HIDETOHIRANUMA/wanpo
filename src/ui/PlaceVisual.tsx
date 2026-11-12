import React, { useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { CATEGORY_LABEL } from '@/domain/labels';
import type { MediaKind, Place, PlaceCategory, PlaceMedia } from '@/domain/types';
import { Icon } from './components';
import { colors, radius, space, type } from './theme';

export const MEDIA_KIND_LABEL: Record<MediaKind, string> = {
  exterior: '外観',
  interior: '店内',
  atmosphere: '雰囲気',
  dog_area: '犬と過ごせる席',
};

/** 一覧のカードに出す写真：外観 → 犬と過ごせる席 → 店内 → 雰囲気 の順で1枚 */
export function coverMedia(media: PlaceMedia[]): PlaceMedia | undefined {
  const order: MediaKind[] = ['exterior', 'dog_area', 'interior', 'atmosphere'];
  return [...media].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind))[0];
}

interface Palette {
  sky: string;
  wall: string;
  stripeA: string;
  stripeB: string;
  sign: string;
  door: string;
  ground: string;
}

/** 落ち着いた色の組み合わせ（写真ではないと分かるフラットなイラスト用） */
const PALETTES: Palette[] = [
  { sky: '#DFF1EC', wall: '#F6EBDD', stripeA: '#0F766E', stripeB: '#FFFFFF', sign: '#16352E', door: '#7A5236', ground: '#CFE3DD' },
  { sky: '#E6EEF8', wall: '#FBF5EC', stripeA: '#C2553D', stripeB: '#FFF6EE', sign: '#3B2A22', door: '#5C4033', ground: '#D9E2EC' },
  { sky: '#F3EEDF', wall: '#E8F0E6', stripeA: '#3F6E4E', stripeB: '#F7F3E3', sign: '#2B3D2F', door: '#6B4E31', ground: '#DCD6C3' },
  { sky: '#EDE9F6', wall: '#FFF8F0', stripeA: '#5B3B8C', stripeB: '#FFFFFF', sign: '#2E2244', door: '#4A3B5C', ground: '#DDD7EA' },
  { sky: '#FFF1E2', wall: '#F2E8DA', stripeA: '#B7791F', stripeB: '#FFFBF2', sign: '#3D2B12', door: '#6E4B26', ground: '#E8DCCB' },
  { sky: '#E3F3F7', wall: '#F4F1EA', stripeA: '#1F5F7A', stripeB: '#FFFFFF', sign: '#173847', door: '#3E5560', ground: '#CBDDE3' },
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * 店舗写真が未登録のときのイメージイラスト（実在の店舗の見た目を表すものではない）。
 * 業種ごとに建物の形を変え、施設IDから色を決める。
 */
export function StorefrontIllustration({ seed, category, style }: { seed: string; category: PlaceCategory; style?: ViewStyle }) {
  const pal = PALETTES[hash(seed) % PALETTES.length];
  const variant = hash(seed + 'v') % 3;
  return (
    <View style={[styles.illu, { backgroundColor: pal.sky }, style]}>
      {/* 遠景の丸（太陽・木） */}
      <View style={[styles.sun, { backgroundColor: pal.stripeB, opacity: 0.8 }]} />
      {category === 'commercial' || category === 'home_center' ? (
        <Mall pal={pal} />
      ) : category === 'other_rest' || category === 'public_facility' ? (
        <Lounge pal={pal} />
      ) : (
        <Shop pal={pal} variant={variant} restaurant={category === 'restaurant'} />
      )}
      <View style={[styles.ground, { backgroundColor: pal.ground }]} />
    </View>
  );
}

function Shop({ pal, variant, restaurant }: { pal: Palette; variant: number; restaurant: boolean }) {
  const stripes = Array.from({ length: 9 });
  return (
    <View style={[styles.building, { backgroundColor: pal.wall }]}>
      <View style={[styles.signBand, { backgroundColor: pal.sign }]}>
        <Icon name={restaurant ? 'restaurant' : 'cafe'} size={15} color="#FFFFFF" />
      </View>
      <View style={styles.awning}>
        {stripes.map((_, i) => (
          <View key={i} style={{ flex: 1, backgroundColor: i % 2 === 0 ? pal.stripeA : pal.stripeB }} />
        ))}
      </View>
      <View style={styles.scallops}>
        {stripes.map((_, i) => (
          <View key={i} style={[styles.scallop, { backgroundColor: i % 2 === 0 ? pal.stripeA : pal.stripeB }]} />
        ))}
      </View>
      <View style={styles.facadeRow}>
        <Window pal={pal} wide={variant === 1} />
        <View style={[styles.door, { backgroundColor: pal.door }]}>
          <View style={styles.doorGlass} />
          <View style={styles.knob} />
        </View>
        <Window pal={pal} wide={variant === 2} />
      </View>
      <View style={styles.planters}>
        <Plant />
        <Icon name="paw" size={16} color={pal.sign} style={{ marginBottom: 1 }} />
        <Plant />
      </View>
    </View>
  );
}

function Window({ pal, wide }: { pal: Palette; wide: boolean }) {
  return (
    <View style={[styles.window, { flex: wide ? 1.4 : 1, borderColor: pal.sign }]}>
      <View style={styles.windowLight} />
      <View style={[styles.mullion, { backgroundColor: pal.sign }]} />
    </View>
  );
}

function Plant() {
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={styles.leaf} />
      <View style={styles.pot} />
    </View>
  );
}

function Mall({ pal }: { pal: Palette }) {
  return (
    <View style={[styles.mall, { backgroundColor: pal.wall, borderColor: pal.sign }]}>
      <View style={[styles.mallSign, { backgroundColor: pal.stripeA }]} />
      {[0, 1, 2].map((r) => (
        <View key={r} style={styles.mallRow}>
          {[0, 1, 2, 3].map((c) => (
            <View key={c} style={[styles.mallWin, (r + c) % 3 === 0 && { backgroundColor: '#FFE7A8' }]} />
          ))}
        </View>
      ))}
      <View style={[styles.mallEntrance, { backgroundColor: pal.sign }]} />
    </View>
  );
}

function Lounge({ pal }: { pal: Palette }) {
  return (
    <View style={[styles.building, { backgroundColor: pal.wall, justifyContent: 'flex-end' }]}>
      <View style={[styles.bigWindow, { borderColor: pal.sign }]}>
        <View style={styles.windowLight} />
        <View style={[styles.bench, { backgroundColor: pal.stripeA }]} />
        <View style={[styles.benchLegs]}>
          <View style={[styles.leg, { backgroundColor: pal.sign }]} />
          <View style={[styles.leg, { backgroundColor: pal.sign }]} />
        </View>
      </View>
    </View>
  );
}

/**
 * 一覧・詳細の上部ビジュアル。運営が権利を確認した店舗写真があれば写真、なければイメージイラスト。
 * 写真には出典を必ず重ねて表示する。
 */
export function PlaceHero({
  place,
  height = 168,
  rounded = true,
  overlay,
}: {
  place: Place;
  height?: number;
  rounded?: boolean | 'all';
  /** 右上に重ねる操作（保存ボタンなど） */
  overlay?: React.ReactNode;
}) {
  const cover = coverMedia(place.media);
  const [failed, setFailed] = useState(false);
  const r = rounded === 'all' ? { borderRadius: radius.lg } : rounded ? { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg } : null;
  if (cover && !failed) {
    return (
      <View style={[{ height, overflow: 'hidden', backgroundColor: colors.mint }, r]}>
        <Image
          source={{ uri: cover.url }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          onError={() => setFailed(true)}
          accessibilityLabel={`${place.name}の${MEDIA_KIND_LABEL[cover.kind]}の写真`}
        />
        <View style={styles.pillTL}>
          <Icon name="image-outline" size={12} color="#FFFFFF" />
          <Text style={styles.pillText}>
            {MEDIA_KIND_LABEL[cover.kind]}
            {place.media.length > 1 ? `・写真 ${place.media.length}枚` : ''}
          </Text>
        </View>
        {overlay ? <View style={styles.overlayTR}>{overlay}</View> : null}
        <View style={styles.credit}>
          <Text style={styles.creditText} numberOfLines={1}>
            写真：{cover.credit}
          </Text>
        </View>
      </View>
    );
  }
  return (
    <View
      style={[{ height, overflow: 'hidden' }, r]}
      accessible
      accessibilityLabel={`店舗写真は未登録です（${CATEGORY_LABEL[place.category]}のイメージイラスト）`}
    >
      <StorefrontIllustration seed={place.id} category={place.category} style={{ flex: 1 }} />
      <View style={styles.pillTL}>
        <Icon name="color-palette-outline" size={12} color="#FFFFFF" />
        <Text style={styles.pillText}>イメージ（写真未登録）</Text>
      </View>
      {overlay ? <View style={styles.overlayTR}>{overlay}</View> : null}
    </View>
  );
}

/** 保存一覧などの小さな正方形の画像（写真があれば写真、なければイメージ） */
export function PlaceThumb({ place, size = 76 }: { place: Place; size?: number }) {
  const cover = coverMedia(place.media);
  const [failed, setFailed] = useState(false);
  return (
    <View style={{ width: size, height: size, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.mint }}>
      {cover && !failed ? (
        <Image source={{ uri: cover.url }} style={StyleSheet.absoluteFill} resizeMode="cover" onError={() => setFailed(true)} accessibilityLabel={`${place.name}の写真`} />
      ) : (
        <StorefrontIllustration seed={place.id} category={place.category} style={{ flex: 1 }} />
      )}
    </View>
  );
}

/** 詳細画面：店舗写真を横にスクロールして見る */
export function MediaGallery({ media }: { media: PlaceMedia[] }) {
  if (media.length === 0) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
      {media.map((m) => (
        <View key={m.id} style={{ width: 260 }}>
          <Image
            source={{ uri: m.url }}
            style={styles.galleryImg}
            resizeMode="cover"
            accessibilityLabel={`${MEDIA_KIND_LABEL[m.kind]}の写真${m.caption ? `：${m.caption}` : ''}`}
          />
          <Text style={type.label}>
            {MEDIA_KIND_LABEL[m.kind]}
            {m.caption ? `・${m.caption}` : ''}
          </Text>
          <Text style={type.small} numberOfLines={2}>
            写真：{m.credit}（{m.rights}）
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  illu: { overflow: 'hidden', justifyContent: 'flex-end', alignItems: 'center' },
  sun: { position: 'absolute', width: 70, height: 70, borderRadius: 35, top: 14, right: 26 },
  ground: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '13%' },
  building: { width: '68%', height: '80%', marginBottom: '6%', borderTopLeftRadius: 6, borderTopRightRadius: 6, overflow: 'hidden', zIndex: 1 },
  signBand: { height: '16%', alignItems: 'center', justifyContent: 'center' },
  awning: { height: '13%', flexDirection: 'row' },
  scallops: { flexDirection: 'row', height: 8, marginTop: -4 },
  scallop: { flex: 1, height: 8, borderBottomLeftRadius: 8, borderBottomRightRadius: 8 },
  facadeRow: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 10, paddingTop: 10 },
  window: { height: '78%', borderWidth: 3, borderRadius: 3, overflow: 'hidden', marginBottom: 6 },
  windowLight: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: '#FFEFC2' },
  mullion: { position: 'absolute', left: '50%', top: 0, bottom: 0, width: 2 },
  door: { width: '22%', height: '92%', borderTopLeftRadius: 4, borderTopRightRadius: 4, alignItems: 'center', paddingTop: 6 },
  doorGlass: { width: '60%', height: '40%', backgroundColor: '#FFEFC2', borderRadius: 2, opacity: 0.9 },
  knob: { position: 'absolute', right: 5, top: '58%', width: 4, height: 4, borderRadius: 2, backgroundColor: '#F4D58D' },
  planters: { position: 'absolute', bottom: 0, left: 4, right: 4, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  leaf: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#5E9C6E' },
  pot: { width: 12, height: 9, backgroundColor: '#B5734B', borderBottomLeftRadius: 3, borderBottomRightRadius: 3 },
  mall: { width: '72%', height: '84%', marginBottom: '6%', borderWidth: 3, borderBottomWidth: 0, borderTopLeftRadius: 4, borderTopRightRadius: 4, padding: 8, gap: 6, zIndex: 1 },
  mallSign: { height: 10, borderRadius: 3, width: '50%', alignSelf: 'center' },
  mallRow: { flex: 1, flexDirection: 'row', gap: 6 },
  mallWin: { flex: 1, backgroundColor: '#CFE7F2', borderRadius: 2 },
  mallEntrance: { height: '18%', width: '36%', alignSelf: 'center', borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  bigWindow: { height: '72%', marginHorizontal: 12, marginBottom: 10, borderWidth: 3, borderRadius: 4, overflow: 'hidden', justifyContent: 'flex-end', alignItems: 'center' },
  bench: { width: '62%', height: 12, borderRadius: 3 },
  benchLegs: { width: '54%', flexDirection: 'row', justifyContent: 'space-between', height: 12 },
  leg: { width: 4, height: 12 },
  pillTL: { position: 'absolute', top: 10, left: 10, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(8,26,23,0.62)', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  overlayTR: { position: 'absolute', top: 8, right: 8 },
  pillText: { color: '#fff', fontSize: 11.5, fontWeight: '700' },
  credit: { position: 'absolute', right: 0, bottom: 0, maxWidth: '80%', backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 8, paddingVertical: 2, borderTopLeftRadius: 6 },
  creditText: { color: '#fff', fontSize: 11 },
  galleryImg: { width: 260, height: 170, borderRadius: radius.md, backgroundColor: colors.mint, marginBottom: 4 },
});
