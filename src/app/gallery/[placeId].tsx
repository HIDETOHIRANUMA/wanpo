import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { RepoError } from '@/data/repository';
import { DOG_SIZE_LABEL } from '@/domain/labels';
import { DOG_SIZES, type DogSize } from '@/domain/types';
import { normalizeBreed, similarity, sortBySimilarity, type UserPhoto } from '@/domain/ugc';
import { useApp } from '@/state/AppContext';
import { Button, Chip, DemoBanner, EmptyState, ErrorState, Loading } from '@/ui/components';
import { errorMessage } from '@/ui/errors';
import { colors, space, type } from '@/ui/theme';
import { myDog, PhotoThumb, PhotoViewer, UgcActionSheet, type UgcTarget } from '@/ui/UgcSection';

type Filter = { kind: 'all' } | { kind: 'similar' } | { kind: 'size'; size: DogSize } | { kind: 'breed'; breed: string };

/**
 * 犬が主役の写真：このお店で過ごした犬の写真を、大きさ・犬種で絞り込んで見る。
 * 「うちと同じくらいの子が実際に入れている」ことを確かめるための画面。
 */
export default function GalleryScreen() {
  const { placeId: raw } = useLocalSearchParams<{ placeId: string }>();
  const placeId = String(raw);
  const { backend, profile, isDemo } = useApp();
  const { width } = useWindowDimensions();
  const [photos, setPhotos] = useState<UserPhoto[] | null>(null);
  const [error, setError] = useState<RepoError | null>(null);
  const [filter, setFilter] = useState<Filter>({ kind: 'all' });
  const [viewer, setViewer] = useState<UserPhoto | null>(null);
  const [action, setAction] = useState<UgcTarget | null>(null);
  const mine = myDog(profile);
  const hasMyDog = !!(mine.size || mine.breed);

  const load = useCallback(() => {
    let alive = true;
    backend.ugc
      .listPhotos(placeId)
      .then((p) => alive && (setPhotos(p), setError(null)))
      .catch((e) => alive && setError(e instanceof RepoError ? e : new RepoError('network')));
    return () => {
      alive = false;
    };
  }, [backend, placeId]);
  useFocusEffect(load);

  // 写真に出てくる犬種（多い順に6つ）
  const breeds = useMemo(() => {
    const count = new Map<string, { label: string; n: number }>();
    for (const p of photos ?? []) {
      if (!p.dogBreed) continue;
      const k = normalizeBreed(p.dogBreed);
      const cur = count.get(k);
      count.set(k, { label: cur?.label ?? p.dogBreed, n: (cur?.n ?? 0) + 1 });
    }
    return [...count.values()].sort((a, b) => b.n - a.n).slice(0, 6).map((x) => x.label);
  }, [photos]);

  const shown = useMemo(() => {
    const all = hasMyDog ? sortBySimilarity(photos ?? [], mine) : photos ?? [];
    switch (filter.kind) {
      case 'all':
        return all;
      case 'similar':
        return all.filter((p) => similarity(p, mine) > 0);
      case 'size':
        return all.filter((p) => p.dogSize === filter.size);
      case 'breed':
        return all.filter((p) => normalizeBreed(p.dogBreed) === normalizeBreed(filter.breed));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos, filter, hasMyDog, mine.size, mine.breed]);

  const cols = width >= 700 ? 4 : 3;
  const gap = space.sm;
  const size = Math.floor((Math.min(width, 900) - space.lg * 2 - gap * (cols - 1)) / cols);
  const is = (f: Filter) => JSON.stringify(f) === JSON.stringify(filter);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: '犬の写真' }} />
      {isDemo ? <DemoBanner /> : null}
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: 48 }}>
        <Text style={type.small}>このお店で過ごした犬たちです。大きさや犬種で絞り込むと、うちの子と同じくらいの子が入れているか確かめられます。</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
          <Chip label="すべて" selected={is({ kind: 'all' })} onPress={() => setFilter({ kind: 'all' })} />
          {hasMyDog ? <Chip label="うちの子に近い" icon="paw-outline" selected={is({ kind: 'similar' })} onPress={() => setFilter({ kind: 'similar' })} /> : null}
          {DOG_SIZES.map((s) => (
            <Chip key={s} label={DOG_SIZE_LABEL[s]} selected={is({ kind: 'size', size: s })} onPress={() => setFilter({ kind: 'size', size: s })} />
          ))}
          {breeds.map((b) => (
            <Chip key={b} label={b} selected={is({ kind: 'breed', breed: b })} onPress={() => setFilter({ kind: 'breed', breed: b })} />
          ))}
        </ScrollView>

        {error ? (
          <ErrorState message={errorMessage(error, '写真を読み込めませんでした。')} onRetry={load} />
        ) : photos === null ? (
          <Loading />
        ) : shown.length === 0 ? (
          <EmptyState icon="images-outline" title={photos.length ? 'この条件の写真はまだありません' : 'まだ写真はありません'} body="ここで過ごした犬の写真を投稿できます。" />
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>
            {shown.map((p) => (
              <PhotoThumb key={p.id} photo={p} size={size} onPress={() => setViewer(p)} similar={hasMyDog && similarity(p, mine) > 0} />
            ))}
          </View>
        )}
        <Button label="犬の写真を投稿する" icon="camera-outline" variant="secondary" onPress={() => router.push({ pathname: '/photo/[placeId]', params: { placeId } })} />
        {isDemo ? <Text style={type.caption}>デモの写真はイラストです（実在の犬・お店の写真ではありません）。</Text> : null}
      </ScrollView>
      <PhotoViewer
        photo={viewer}
        onClose={() => setViewer(null)}
        onMenu={(p) => {
          setViewer(null);
          setAction({ kind: 'photo', item: p });
        }}
      />
      <UgcActionSheet
        target={action}
        onClose={() => setAction(null)}
        onDone={() => {
          setAction(null);
          load();
        }}
      />
    </View>
  );
}
