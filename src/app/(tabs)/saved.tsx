import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RepoError } from '@/data/repository';
import { judgeBase } from '@/domain/judge';
import { CATEGORY_LABEL } from '@/domain/labels';
import { formatJstDateTime, keyFreshness } from '@/domain/verification';
import { useApp } from '@/state/AppContext';
import type { SavedStatus } from '@/storage/savedPlaces';
import { Badge, Button, DemoBanner, EmptyState, IconButton, Loading, Notice, ScreenHeader } from '@/ui/components';
import { PlaceThumb } from '@/ui/PlaceVisual';
import { errorMessage } from '@/ui/errors';
import { baseBadge, freshnessText } from '@/ui/status';
import { zoneSummary } from '@/ui/summaries';
import { colors, radius, shadow, space, type } from '@/ui/theme';

export default function SavedScreen() {
  const { backend, savedStore, saved, reloadSaved, toggleSave, isDemo, config } = useApp();
  const [statuses, setStatuses] = useState<SavedStatus[] | null>(null);
  const [error, setError] = useState<RepoError | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    // オンラインなら最新の公開状態・条件を再確認。失敗時はキャッシュ表示
    const r = await savedStore.refresh(backend.places);
    setStatuses(r.statuses);
    setError(r.error);
    await reloadSaved();
    setRefreshing(false);
  }, [backend, savedStore, reloadSaved]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const now = new Date();
  const visible = (statuses ?? []).filter((s) => saved.some((e) => e.placeId === s.place.id));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      {isDemo ? <DemoBanner /> : null}
      <ScreenHeader title="保存した施設" subtitle={visible.length ? `${visible.length}件・この端末に保存` : 'ログイン不要・この端末に保存'} />
      {error ? (
        <View style={{ marginHorizontal: space.lg, marginBottom: space.md, gap: space.sm }}>
          <Notice tone="warn" icon="cloud-offline-outline" title="保存時の情報を表示しています（最新ではない可能性があります）" body={errorMessage(error)} />
          <Button label="再試行" icon="refresh" variant="secondary" size="sm" onPress={refresh} loading={refreshing} style={{ alignSelf: 'flex-start' }} />
        </View>
      ) : null}
      {statuses === null ? (
        <Loading />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(s) => s.place.id}
          contentContainerStyle={{ paddingTop: space.sm, paddingBottom: space.xxl }}
          ListEmptyComponent={
            <EmptyState
              icon="heart-outline"
              title="保存した施設はまだありません"
              body="気になる施設のハートを押すと、ここに集まります。ログイン不要で、この端末に保存されます。"
            >
              <Button label="施設を探す" icon="search" onPress={() => router.navigate('/')} />
            </EmptyState>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Pressable
                onPress={() => router.push(`/place/${item.place.id}`)}
                accessibilityRole="button"
                accessibilityLabel={`${item.place.name}の詳細を見る`}
                style={({ pressed }) => [styles.row, pressed && { opacity: 0.9 }]}
              >
                <PlaceThumb place={item.place} size={84} />
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={styles.name} numberOfLines={2}>
                    {item.place.name}
                  </Text>
                  <Text style={type.caption} numberOfLines={1}>
                    {CATEGORY_LABEL[item.place.category]}・{zoneSummary(item.place.zone)}
                  </Text>
                  {item.kind === 'unavailable' ? (
                    <Badge size="sm" info={{ tone: 'bad', label: '現在の掲載情報を確認できません（電話・経路は使えません）' }} />
                  ) : (
                    <View style={{ gap: 4 }}>
                      <Badge size="sm" info={baseBadge(judgeBase(item.place))} />
                      <Badge size="sm" info={freshnessText(keyFreshness(item.place.verifications, now, config.settings))} />
                    </View>
                  )}
                </View>
              </Pressable>
              <View style={styles.footer}>
                <Text style={[type.caption, { flex: 1 }]}>
                  {item.kind === 'cached' ? 'キャッシュ・' : ''}情報の取得日時：{formatJstDateTime(item.fetchedAt)}
                </Text>
                <IconButton icon="heart" color={colors.heart} background={'#FFF1F1'} size={36} label={`${item.place.name}の保存を解除`} onPress={() => toggleSave(item.place)} />
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginHorizontal: space.lg,
    marginBottom: space.md,
    overflow: 'hidden',
    ...shadow.card,
  },
  row: { flexDirection: 'row', gap: space.md, padding: space.md },
  name: { fontSize: 16, lineHeight: 22, fontWeight: '800', color: colors.text },
  footer: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, paddingVertical: space.sm, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surfaceAlt },
});
