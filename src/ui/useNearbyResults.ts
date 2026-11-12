import { useEffect, useMemo, useState } from 'react';
import { RepoError } from '@/data/repository';
import type { LatLng } from '@/domain/geo';
import { DEFAULT_FILTERS, searchPlaces, type RadiusKm, type SearchOrigin, type SearchResult } from '@/domain/search';
import type { Place } from '@/domain/types';
import { useApp } from '@/state/AppContext';

/**
 * 基準点の近くの「室内同伴・冷房が確認済み」の候補を距離順で取得する（いますぐ涼みたい・お散歩プラン用）。
 * 探す画面と同じ検索関数を使う。
 */
export function useNearbyResults(origin: SearchOrigin, radiusKm: RadiusKm, now: Date) {
  const { backend, profile, config } = useApp();
  const [reload, setReload] = useState(0);
  const key = `${origin.lat},${origin.lng},${radiusKm},${reload}`;
  // 取得結果はキーと一緒に持ち、キーが変わったら「読み込み中」とみなす
  const [state, setState] = useState<{ key: string; places: Place[] | null; error: RepoError | null } | null>(null);
  const current = state?.key === key ? state : null;
  const places = current?.places ?? null;
  const error = current?.error ?? null;

  useEffect(() => {
    let alive = true;
    const center: LatLng = { lat: origin.lat, lng: origin.lng };
    backend.places
      .listPlacesNear(center, radiusKm)
      .then((p) => alive && setState({ key, places: p, error: null }))
      .catch((e) => alive && setState({ key, places: null, error: e instanceof RepoError ? e : new RepoError('network') }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backend, key]);

  const results: SearchResult[] = useMemo(
    () =>
      places
        ? searchPlaces({
            places,
            // エリア限定は外す（近さだけで探す）
            origin: { ...origin, areaId: undefined },
            filters: { ...DEFAULT_FILTERS, radiusKm },
            query: '',
            profile,
            now,
            settings: config.settings,
          })
        : [],
    [places, origin, radiusKm, profile, now, config.settings],
  );

  return { loading: places === null && !error, error, results, retry: () => setReload((k) => k + 1) };
}
