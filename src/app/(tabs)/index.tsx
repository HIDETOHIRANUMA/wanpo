import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DEFAULT_ORIGIN } from '@/data/demo/areas';
import { RepoError } from '@/data/repository';
import {
  activeRestrictions,
  DEFAULT_FILTERS,
  FILTER_LABEL,
  RADIUS_OPTIONS,
  searchPlaces,
  type FilterKey,
  type SearchFilters,
  type SearchOrigin,
} from '@/domain/search';
import { PREFECTURES } from '@/domain/prefectures';
import type { Area, Place, Station } from '@/domain/types';
import type { UgcCounts } from '@/domain/ugc';
import { useApp } from '@/state/AppContext';
import { Button, Chip, DemoBanner, ErrorState, Loading, ToggleRow } from '@/ui/components';
import { errorMessage } from '@/ui/errors';
import { getCurrentLocationOnce, LOCATION_FAILURE_MESSAGE } from '@/ui/location';
import { PlaceCard } from '@/ui/PlaceCard';
import { SearchMap } from '@/ui/SearchMap';
import { colors, MIN_TAP, radius, space, type } from '@/ui/theme';

type LoadState = { key: string; error: RepoError | null } | null;

export default function SearchScreen() {
  const { backend, isDemo, profile, config, lastOrigin } = useApp();
  const [load, setLoad] = useState<LoadState>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [counts, setCounts] = useState<Record<string, UgcCounts>>({});
  const [origin, setOriginState] = useState<SearchOrigin>(DEFAULT_ORIGIN);
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS);
  const [query, setQuery] = useState('');
  const [view, setView] = useState<'list' | 'map'>('list');
  const [sheet, setSheet] = useState<null | 'filters' | 'origin' | 'location-explain'>(null);
  const [locBusy, setLocBusy] = useState(false);
  const [locMessage, setLocMessage] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [originReady, setOriginReady] = useState(false);

  const [reloadKey, setReloadKey] = useState(0);
  const retry = () => setReloadKey((k) => k + 1);

  const setOrigin = (o: SearchOrigin) => {
    setOriginState(o);
    // 前回の基準点として端末に保存（現在地は保存しない）
    lastOrigin.save(o).catch(() => undefined);
  };

  // 前回の基準点（エリア・駅・地図の中心）から始める
  useEffect(() => {
    let alive = true;
    lastOrigin
      .load()
      .then((o) => {
        if (alive && o) setOriginState(o);
      })
      .catch(() => undefined)
      .finally(() => alive && setOriginReady(true));
    return () => {
      alive = false;
    };
  }, [lastOrigin]);

  // 基準点と距離の範囲にある施設だけを取得（全国のデータを一度に読み込まない）
  const loadKey = `${origin.lat},${origin.lng},${filters.radiusKm},${reloadKey}`;
  useEffect(() => {
    if (!originReady) return;
    let alive = true;
    (async () => {
      try {
        const p = await backend.places.listPlacesNear({ lat: origin.lat, lng: origin.lng }, filters.radiusKm);
        if (!alive) return;
        setPlaces(p);
        setNow(new Date());
        setLoad({ key: loadKey, error: null });
        // 件数は補助情報。取得できなくても一覧は表示する
        backend.places
          .getUgcCounts(p.map((x) => x.id))
          .then((c) => alive && setCounts(c))
          .catch(() => alive && setCounts({}));
      } catch (e) {
        // 本番の通信障害でもデモへ切り替えない
        if (alive) setLoad({ key: loadKey, error: e instanceof RepoError ? e : new RepoError('network') });
      }
    })();
    return () => {
      alive = false;
    };
  }, [backend, loadKey, origin.lat, origin.lng, filters.radiusKm, originReady]);

  const loading = load === null || (load.key !== loadKey && places.length === 0);
  const refreshing = load !== null && load.key !== loadKey;
  const loadError = load && load.key === loadKey ? load.error : null;

  // 「営業時間上は営業中」の表示を1分ごとに更新
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const areaNames = useMemo(() => Object.fromEntries(places.filter((p) => p.areaName).map((p) => [p.areaId, p.areaName!])), [places]);

  // 地図と一覧は同じ結果配列を使う
  const results = useMemo(
    () => searchPlaces({ places, origin, filters, query, profile, now, settings: config.settings, areaNames }),
    [places, origin, filters, query, profile, now, config.settings, areaNames],
  );

  const removeRestriction = (k: FilterKey) => {
    if (k === 'query') setQuery('');
    else if (k === 'area') setOrigin({ ...origin, areaId: undefined, label: `${origin.label}（エリア限定なし）` });
    else if (k === 'radiusKm') setFilters({ ...filters, radiusKm: 10 });
    else if (k === 'includeBaseUnconfirmed' || k === 'includeDogNeedsCheck') setFilters({ ...filters, [k]: true });
    else setFilters({ ...filters, [k]: false });
  };

  const useCurrentLocation = async () => {
    setSheet(null);
    setLocBusy(true);
    setLocMessage(null);
    const r = await getCurrentLocationOnce();
    setLocBusy(false);
    if (r.ok) setOrigin({ kind: 'current_location', label: '現在地', ...r.coords });
    else setLocMessage(LOCATION_FAILURE_MESSAGE[r.reason]);
  };

  const activeCount = activeRestrictions(filters, '', { ...origin, areaId: undefined }).filter(
    (k) => k !== 'includeBaseUnconfirmed' && k !== 'includeDogNeedsCheck',
  ).length;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {isDemo ? <DemoBanner /> : null}
      <View style={styles.top}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="施設名・エリア名で検索"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          accessibilityLabel="施設名・エリア名で検索"
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        <View style={styles.row}>
          <Pressable
            style={styles.originBox}
            onPress={() => setSheet('origin')}
            accessibilityRole="button"
            accessibilityLabel={`検索の基準点：${origin.label}。タップで変更`}
          >
            <Text style={type.small}>検索の基準点</Text>
            <Text style={type.label} numberOfLines={2}>
              📍 {origin.label}
            </Text>
          </Pressable>
          <Button label={locBusy ? '取得中…' : '現在地から探す'} variant="secondary" onPress={() => setSheet('location-explain')} loading={locBusy} />
        </View>
        {locMessage ? (
          <Text style={styles.notice} accessibilityLiveRegion="polite">
            {locMessage}
          </Text>
        ) : null}
        <View style={styles.row}>
          <View style={styles.segment} accessibilityRole="tablist">
            {(['list', 'map'] as const).map((v) => (
              <Pressable
                key={v}
                onPress={() => setView(v)}
                style={[styles.segItem, view === v && styles.segActive]}
                accessibilityRole="tab"
                accessibilityState={{ selected: view === v }}
              >
                <Text style={[type.label, view === v && { color: '#fff' }]}>{v === 'list' ? '一覧' : '地図'}</Text>
              </Pressable>
            ))}
          </View>
          <Button
            label={`絞り込み${activeCount ? `（${activeCount}）` : ''}`}
            variant="secondary"
            onPress={() => setSheet('filters')}
          />
        </View>
        <Text style={type.small}>
          {filters.includeBaseUnconfirmed
            ? '室内同伴・冷房が未確認の候補も表示中'
            : '同じ区画で室内同伴・冷房の確認情報がある施設を表示'}
          ・{filters.radiusKm}km以内・距離順
        </Text>
      </View>

      {refreshing && !loading ? (
        <Text style={[type.small, { paddingHorizontal: space.lg, paddingTop: space.xs }]} accessibilityLiveRegion="polite">
          更新中…
        </Text>
      ) : null}
      {loading ? (
        <Loading />
      ) : loadError ? (
        <ErrorState message={errorMessage(loadError, '施設情報を読み込めませんでした。')} onRetry={retry} />
      ) : view === 'map' ? (
        <SearchMap
          results={results}
          origin={origin}
          radiusKm={filters.radiusKm}
          onSearchHere={(c) => setOrigin({ kind: 'map_center', label: '地図の中心', ...c })}
        />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(r) => r.place.id}
          contentContainerStyle={{ paddingTop: space.md, paddingBottom: space.xl }}
          ListHeaderComponent={<Text style={[type.small, { marginHorizontal: space.lg, marginBottom: space.sm }]}>{results.length}件</Text>}
          renderItem={({ item }) => <PlaceCard result={item} originLabel={origin.label} counts={counts[item.place.id]} />}
          ListEmptyComponent={
            <EmptyResults restrictions={activeRestrictions(filters, query, origin)} onRemove={removeRestriction} />
          }
        />
      )}

      <FilterSheet visible={sheet === 'filters'} filters={filters} onChange={setFilters} onClose={() => setSheet(null)} hasProfile={!!profile} />
      <OriginSheet
        visible={sheet === 'origin'}
        onClose={() => setSheet(null)}
        onPick={(o) => {
          setOrigin(o);
          setLocMessage(null);
          setSheet(null);
        }}
      />
      <Modal visible={sheet === 'location-explain'} transparent animationType="fade" onRequestClose={() => setSheet(null)}>
        <View style={styles.backdrop}>
          <View style={styles.dialog} accessibilityViewIsModal>
            <Text style={type.heading}>現在地の利用について</Text>
            <Text style={[type.body, { marginTop: space.sm }]}>
              近くの休憩先を直線距離の順に並べるため、今回だけ現在地を取得します。現在地は端末内での距離計算にだけ使い、保存・送信しません。
            </Text>
            <View style={{ gap: space.sm, marginTop: space.lg }}>
              <Button label="現在地を使う" onPress={useCurrentLocation} />
              <Button label="使わない（エリア・駅から探す）" variant="secondary" onPress={() => setSheet('origin')} />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function EmptyResults({ restrictions, onRemove }: { restrictions: FilterKey[]; onRemove: (k: FilterKey) => void }) {
  return (
    <View style={{ padding: space.xl, gap: space.md }}>
      <Text style={type.heading}>条件に合う施設はありません</Text>
      <Text style={type.body}>条件は自動では緩めません。外す条件を選んでください。</Text>
      {restrictions.map((k) => (
        <Button
          key={k}
          variant="secondary"
          label={
            k === 'includeBaseUnconfirmed' || k === 'includeDogNeedsCheck'
              ? `「${FILTER_LABEL[k]}」をONにする`
              : k === 'radiusKm'
                ? '距離を10kmに広げる'
                : `「${FILTER_LABEL[k]}」を外す`
          }
          onPress={() => onRemove(k)}
        />
      ))}
    </View>
  );
}

function FilterSheet({
  visible,
  filters,
  onChange,
  onClose,
  hasProfile,
}: {
  visible: boolean;
  filters: SearchFilters;
  onChange: (f: SearchFilters) => void;
  onClose: () => void;
  hasProfile: boolean;
}) {
  const set = <K extends keyof SearchFilters>(k: K, v: SearchFilters[K]) => onChange({ ...filters, [k]: v });
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <SafeAreaView style={styles.sheet} edges={['bottom']}>
          <ScrollView contentContainerStyle={{ padding: space.lg }}>
            <Text style={type.title} accessibilityRole="header">
              絞り込み
            </Text>
            <Text style={[type.label, { marginTop: space.lg }]}>検索地点からの距離（直線）</Text>
            <View style={styles.chips}>
              {RADIUS_OPTIONS.map((r) => (
                <Chip key={r} label={`${r}km`} selected={filters.radiusKm === r} onPress={() => set('radiusKm', r)} />
              ))}
            </View>
            <Text style={[type.label, { marginTop: space.lg }]}>犬の条件</Text>
            <ToggleRow
              label="うちの犬の条件に合う"
              value={filters.matchMyDog}
              onChange={(v) => onChange({ ...filters, matchMyDog: v, includeDogNeedsCheck: v ? filters.includeDogNeedsCheck : false })}
              note={hasProfile ? '登録した条件に一致する施設だけを表示します' : '犬の条件が未登録のため、一致する施設はありません（要確認として扱います）'}
            />
            <ToggleRow
              label="犬の条件が要確認の候補も含める"
              value={filters.includeDogNeedsCheck}
              onChange={(v) => set('includeDogNeedsCheck', v)}
              disabled={!filters.matchMyDog}
              note="「うちの犬の条件に合う」がONのときだけ使えます。不一致の施設は含めません"
            />
            <Text style={[type.label, { marginTop: space.lg }]}>室内同伴・冷房</Text>
            <ToggleRow
              label="室内同伴・冷房の基本情報が未確認の候補も含める"
              value={filters.includeBaseUnconfirmed}
              onChange={(v) => set('includeBaseUnconfirmed', v)}
              note="室内同伴不可・冷房なしと分かっている施設は含めません"
            />
            <Text style={[type.label, { marginTop: space.lg }]}>利用条件</Text>
            <ToggleRow label="予約なしで利用可能" value={filters.noReservation} onChange={(v) => set('noReservation', v)} />
            <ToggleRow label="飲食注文が不要" value={filters.noOrderRequired} onChange={(v) => set('noOrderRequired', v)} />
            <ToggleRow label="犬用の水がある" value={filters.hasWater} onChange={(v) => set('hasWater', v)} />
            <ToggleRow
              label="営業時間上、現在利用可能"
              value={filters.openNow}
              onChange={(v) => set('openNow', v)}
              note="登録された営業時間と犬同伴可能時間による判定です。当日の営業・空席は保証しません"
            />
            <ToggleRow
              label="主要条件が90日以内に確認されている"
              value={filters.recentlyVerified}
              onChange={(v) => set('recentlyVerified', v)}
              note="確認からの日数の目安で、安全性を示すものではありません"
            />
            <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.xl }}>
              <Button label="初期条件に戻す" variant="secondary" onPress={() => onChange(DEFAULT_FILTERS)} style={{ flex: 1 }} />
              <Button label="閉じる" onPress={onClose} style={{ flex: 1 }} />
            </View>
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

function OriginSheet({ visible, onClose, onPick }: { visible: boolean; onClose: () => void; onPick: (o: SearchOrigin) => void }) {
  const { backend } = useApp();
  const [tab, setTab] = useState<'station' | 'area'>('station');
  const [q, setQ] = useState('');
  const [stationResult, setStationResult] = useState<{ q: string; list: Station[]; error: boolean } | null>(null);
  const [pref, setPref] = useState<number | null>(null);
  const [areaResult, setAreaResult] = useState<{ pref: number; list: Area[]; error: boolean } | null>(null);

  // 駅名：入力が止まってから検索（全国の駅データをまとめて読み込まない）
  const term = q.trim();
  useEffect(() => {
    if (!term) return;
    let alive = true;
    const t = setTimeout(() => {
      backend.places
        .searchStations(term)
        .then((list) => alive && setStationResult({ q: term, list, error: false }))
        .catch(() => alive && setStationResult({ q: term, list: [], error: true }));
    }, 300);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [backend, term]);

  useEffect(() => {
    if (pref === null) return;
    let alive = true;
    backend.places
      .listAreas(pref)
      .then((list) => alive && setAreaResult({ pref, list, error: false }))
      .catch(() => alive && setAreaResult({ pref, list: [], error: true }));
    return () => {
      alive = false;
    };
  }, [backend, pref]);

  const stations = stationResult && stationResult.q === term ? stationResult : null;
  const areas = pref !== null && areaResult?.pref === pref ? areaResult : null;
  const regions = [...new Set(PREFECTURES.map((p) => p.region))];
  const prefName = PREFECTURES.find((p) => p.code === pref)?.name;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <SafeAreaView style={styles.sheet} edges={['bottom']}>
          <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.sm }} keyboardShouldPersistTaps="handled">
            <Text style={type.title} accessibilityRole="header">
              検索の基準点を選ぶ
            </Text>
            <View style={[styles.sheetTabs, { marginTop: space.sm }]} accessibilityRole="tablist">
              {(['station', 'area'] as const).map((v) => (
                <Pressable
                  key={v}
                  onPress={() => setTab(v)}
                  style={[styles.segItem, tab === v && styles.segActive]}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: tab === v }}
                >
                  <Text style={[type.label, tab === v && { color: '#fff' }]}>{v === 'station' ? '駅から' : '都道府県・市区町村から'}</Text>
                </Pressable>
              ))}
            </View>

            {tab === 'station' ? (
              <>
                <TextInput
                  value={q}
                  onChangeText={setQ}
                  placeholder="駅名を入力（例：梅田、天神、大通）"
                  placeholderTextColor={colors.textMuted}
                  style={styles.input}
                  accessibilityLabel="駅名で検索"
                  autoFocus
                />
                {!term ? <Text style={type.small}>全国の駅から探せます（登録済みの駅のみ）。</Text> : null}
                {term && !stations ? <Text style={type.small}>検索中…</Text> : null}
                {stations?.error ? <Text style={{ color: colors.bad }}>駅を検索できませんでした。通信状況を確認してください。</Text> : null}
                {stations && !stations.error && stations.list.length === 0 ? <Text style={type.small}>該当する駅がありません。</Text> : null}
                {stations?.list.map((s) => (
                  <Button
                    key={s.id}
                    label={`${s.name}${s.lineName ? `（${s.lineName}）` : ''}`}
                    variant="secondary"
                    onPress={() => onPick({ kind: 'station', label: s.name, lat: s.lat, lng: s.lng })}
                  />
                ))}
              </>
            ) : pref === null ? (
              <>
                <Button label="東京都心（港区周辺）" variant="secondary" onPress={() => onPick(DEFAULT_ORIGIN)} />
                {regions.map((r) => (
                  <View key={r} style={{ gap: space.xs, marginTop: space.sm }}>
                    <Text style={type.label}>{r}</Text>
                    <View style={styles.chips}>
                      {PREFECTURES.filter((p) => p.region === r).map((p) => (
                        <Chip key={p.code} label={p.name} selected={false} onPress={() => setPref(p.code)} />
                      ))}
                    </View>
                  </View>
                ))}
              </>
            ) : (
              <>
                <Button label="← 都道府県を選び直す" variant="ghost" onPress={() => setPref(null)} />
                <Text style={type.heading}>{prefName}</Text>
                {!areas ? <Text style={type.small}>読み込み中…</Text> : null}
                {areas?.error ? <Text style={{ color: colors.bad }}>市区町村を読み込めませんでした。通信状況を確認してください。</Text> : null}
                {areas && !areas.error && areas.list.length === 0 ? (
                  <Text style={type.small}>{prefName}の掲載エリアはまだありません。駅から探すか、別の都道府県をお選びください。</Text>
                ) : null}
                {areas?.list.map((a) => (
                  <Button
                    key={a.id}
                    label={`${a.name}（中心付近から・${a.name}に限定）`}
                    variant="secondary"
                    onPress={() => onPick({ kind: 'area', label: `${a.name}の中心付近`, lat: a.lat, lng: a.lng, areaId: a.id })}
                  />
                ))}
              </>
            )}
            <Button label="閉じる" onPress={onClose} style={{ marginTop: space.md }} />
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  top: { paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.sm, gap: space.sm, borderBottomWidth: 1, borderColor: colors.border },
  input: {
    minHeight: MIN_TAP,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  row: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  originBox: { flex: 1, minHeight: MIN_TAP, justifyContent: 'center' },
  notice: { ...type.small, color: colors.warn, backgroundColor: colors.warnBg, padding: space.sm, borderRadius: radius.sm },
  segment: { flex: 1, flexDirection: 'row', borderWidth: 1.5, borderColor: colors.primary, borderRadius: radius.md, overflow: 'hidden' },
  sheetTabs: { flexDirection: 'row', borderWidth: 1.5, borderColor: colors.primary, borderRadius: radius.md, overflow: 'hidden' },
  segItem: { flex: 1, minHeight: MIN_TAP, alignItems: 'center', justifyContent: 'center' },
  segActive: { backgroundColor: colors.primary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.bg, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, maxHeight: '90%' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: space.lg },
  dialog: { backgroundColor: colors.bg, borderRadius: radius.lg, padding: space.lg },
});
