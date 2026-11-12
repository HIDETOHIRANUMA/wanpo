import type { PlaceRepository } from '@/data/repository';
import { RepoError } from '@/data/repository';
import type { Place } from '@/domain/types';
import type { LocalStore } from './localStore';

/** 保存時に端末へ残す情報。通信できないときもこれで閲覧できる */
export interface SavedEntry {
  placeId: string;
  savedAt: string;
  /** 最後に公開情報を取得できた日時 */
  fetchedAt: string;
  snapshot: Place;
}

export type SavedStatus =
  | { kind: 'fresh'; place: Place; fetchedAt: string } // オンラインで最新を確認済み
  | { kind: 'cached'; place: Place; fetchedAt: string } // 通信できず、キャッシュを表示
  | { kind: 'unavailable'; place: Place; fetchedAt: string }; // 取得は成功したが掲載が見つからない

const KEY = 'saved-places';

export class SavedPlacesStore {
  constructor(private store: LocalStore) {}

  async list(): Promise<SavedEntry[]> {
    return (await this.store.getJson<SavedEntry[]>(KEY)) ?? [];
  }

  async isSaved(placeId: string): Promise<boolean> {
    return (await this.list()).some((e) => e.placeId === placeId);
  }

  async save(place: Place, now = new Date()): Promise<SavedEntry[]> {
    const list = (await this.list()).filter((e) => e.placeId !== place.id);
    const iso = now.toISOString();
    const next = [{ placeId: place.id, savedAt: iso, fetchedAt: iso, snapshot: place }, ...list];
    await this.store.setJson(KEY, next);
    return next;
  }

  async remove(placeId: string): Promise<SavedEntry[]> {
    const next = (await this.list()).filter((e) => e.placeId !== placeId);
    await this.store.setJson(KEY, next);
    return next;
  }

  /**
   * オンラインで最新の公開状態を再確認する。
   * - 取得成功で見つからないID → unavailable（電話・経路を無効化）
   * - 通信エラー → cached（取得日時を表示）。権限を広げて非公開情報を取りにいかない
   */
  async refresh(repo: PlaceRepository, now = new Date()): Promise<{ statuses: SavedStatus[]; error: RepoError | null }> {
    const list = await this.list();
    if (list.length === 0) return { statuses: [], error: null };
    try {
      const { found } = await repo.getPlacesByIds(list.map((e) => e.placeId));
      const byId = new Map(found.map((p) => [p.id, p]));
      const iso = now.toISOString();
      const next: SavedEntry[] = list.map((e) => {
        const p = byId.get(e.placeId);
        return p ? { ...e, snapshot: p, fetchedAt: iso } : e;
      });
      await this.store.setJson(KEY, next);
      const statuses: SavedStatus[] = next.map((e) =>
        byId.has(e.placeId)
          ? { kind: 'fresh', place: e.snapshot, fetchedAt: e.fetchedAt }
          : { kind: 'unavailable', place: e.snapshot, fetchedAt: e.fetchedAt },
      );
      return { statuses, error: null };
    } catch (e) {
      const err = e instanceof RepoError ? e : new RepoError('network');
      return {
        statuses: list.map((x) => ({ kind: 'cached', place: x.snapshot, fetchedAt: x.fetchedAt })),
        error: err,
      };
    }
  }
}
