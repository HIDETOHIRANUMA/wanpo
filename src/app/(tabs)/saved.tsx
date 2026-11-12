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
import { Badge, Button, DemoBanner, Loading } from '@/ui/components';
import { errorMessage } from '@/ui/errors';
import { baseBadge, freshnessText } from '@/ui/status';
import { zoneSummary } from '@/ui/summaries';
import { colors, radius, space, type } from '@/ui/theme';

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
      <Text style={[type.title, { margin: space.lg }]} accessibilityRole="header">
        保存した施設
      </Text>
      {error ? (
        <View style={styles.offline} accessibilityLiveRegion="polite">
          <Text style={type.label}>保存時の情報を表示しています（最新ではない可能性があります）</Text>
          <Text style={type.small}>{errorMessage(error)}</Text>
          <Button label="再試行" variant="secondary" onPress={refresh} loading={refreshing} style={{ marginTop: space.sm }} />
        </View>
      ) : null}
      {statuses === null ? (
        <Loading />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(s) => s.place.id}
          contentContainerStyle={{ paddingBottom: space.xl }}
          ListEmptyComponent={
            <Text style={[type.body, { margin: space.lg }]}>
              保存した施設はありません。施設のカードや詳細の「保存する」から追加できます（ログイン不要・この端末に保存）。
            </Text>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Pressable
                onPress={() => router.push(`/place/${item.place.id}`)}
                accessibilityRole="button"
                accessibilityLabel={`${item.place.name}の詳細を見る`}
                style={{ gap: space.sm }}
              >
                <Text style={type.heading}>{item.place.name}</Text>
                <Text style={type.small}>
                  {CATEGORY_LABEL[item.place.category]} ・{zoneSummary(item.place.zone)}
                </Text>
                {item.kind === 'unavailable' ? (
                  <Badge info={{ tone: 'bad', label: '現在の掲載情報を確認できません（電話・経路は使えません）' }} />
                ) : (
                  <>
                    <Badge info={baseBadge(judgeBase(item.place))} />
                    <Badge info={freshnessText(keyFreshness(item.place.verifications, now, config.settings))} />
                  </>
                )}
                <Text style={type.small}>
                  {item.kind === 'cached' ? 'キャッシュ・' : ''}情報の取得日時：{formatJstDateTime(item.fetchedAt)}
                </Text>
              </Pressable>
              <Button label="保存を解除" variant="secondary" onPress={() => toggleSave(item.place)} style={{ marginTop: space.md }} />
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  offline: { backgroundColor: colors.warnBg, padding: space.md, marginHorizontal: space.lg, marginBottom: space.md, borderRadius: radius.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
    marginHorizontal: space.lg,
    marginBottom: space.md,
  },
});
