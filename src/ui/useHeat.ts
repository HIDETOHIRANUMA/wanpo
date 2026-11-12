import { useEffect, useState } from 'react';
import type { HeatResult } from '@/data/repository';
import type { LatLng } from '@/domain/geo';
import type { HeatForecast } from '@/domain/heat';
import { useApp } from '@/state/AppContext';

export type HeatState =
  | { status: 'loading' }
  | { status: 'ok'; forecast: HeatForecast }
  | { status: 'unavailable'; reason: Extract<HeatResult, { status: 'unavailable' }>['reason'] }
  | { status: 'error' };

// 同じ地域の予測は30分使い回す（約1km単位。位置は端末の中だけ）
const CACHE_MS = 30 * 60_000;
const cache = new Map<string, { at: number; result: HeatResult }>();

export function useHeat(at: LatLng | null): HeatState {
  const { backend } = useApp();
  const key = at ? `${backend.mode}:${at.lat.toFixed(2)},${at.lng.toFixed(2)}` : null;
  const [state, setState] = useState<{ key: string | null; value: HeatState }>({ key: null, value: { status: 'loading' } });

  useEffect(() => {
    if (!key || !at) return;
    let alive = true;
    const hit = cache.get(key);
    const apply = (r: HeatResult) => alive && setState({ key, value: r.status === 'ok' ? { status: 'ok', forecast: r.forecast } : { status: 'unavailable', reason: r.reason } });
    if (hit && Date.now() - hit.at < CACHE_MS) {
      apply(hit.result);
      return;
    }
    backend.heat
      .forecast(at, new Date())
      .then((r) => {
        cache.set(key, { at: Date.now(), result: r });
        apply(r);
      })
      .catch(() => alive && setState({ key, value: { status: 'error' } }));
    return () => {
      alive = false;
    };
    // 位置は key（丸めた座標）で判定する
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backend, key]);

  return state.key === key ? state.value : { status: 'loading' };
}
