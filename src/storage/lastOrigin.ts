import type { SearchOrigin } from '@/domain/search';
import type { LocalStore } from './localStore';

const KEY = 'last-origin';

/**
 * 前回の検索の基準点（エリア・駅・地図の中心だけ）。
 * 現在地は保存しない（位置の履歴を残さない）。
 */
export class LastOriginStore {
  constructor(private store: LocalStore) {}
  async load(): Promise<SearchOrigin | null> {
    const o = await this.store.getJson<SearchOrigin>(KEY);
    if (!o || o.kind === 'current_location' || !Number.isFinite(o.lat) || !Number.isFinite(o.lng)) return null;
    return o;
  }
  async save(o: SearchOrigin): Promise<void> {
    if (o.kind === 'current_location') return;
    await this.store.setJson(KEY, { kind: o.kind, label: o.label, lat: o.lat, lng: o.lng, areaId: o.areaId });
  }
}
