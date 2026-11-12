import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DataMode } from '@/data/repository';

/** 端末内保存。デモと本番で保存領域（キーの接頭辞）を分け、本番結果へ架空施設を混ぜない */
export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  getAllKeys(): Promise<readonly string[]>;
  multiRemove(keys: readonly string[]): Promise<void>;
}

export const APP_PREFIX = 'inu-to-suzumeru';

export class LocalStore {
  constructor(
    private mode: DataMode,
    private kv: KeyValueStore = AsyncStorage as unknown as KeyValueStore,
  ) {}

  private key(name: string): string {
    return `${APP_PREFIX}:${this.mode}:${name}`;
  }

  async getJson<T>(name: string): Promise<T | null> {
    const raw = await this.kv.getItem(this.key(name));
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async setJson(name: string, value: unknown): Promise<void> {
    await this.kv.setItem(this.key(name), JSON.stringify(value));
  }

  async remove(name: string): Promise<void> {
    await this.kv.removeItem(this.key(name));
  }

  /** このモードの端末データ（保存・犬の条件・下書き）を削除。ログイン状態は keep で残せる */
  async clearMode(keep: string[] = []): Promise<void> {
    const keys = await this.kv.getAllKeys();
    const keepKeys = keep.map((k) => this.key(k));
    const mine = keys.filter((k) => k.startsWith(`${APP_PREFIX}:${this.mode}:`) && !keepKeys.includes(k));
    if (mine.length) await this.kv.multiRemove(mine);
  }
}

/** テスト・Webプレビュー用のメモリ実装 */
export class MemoryKV implements KeyValueStore {
  data = new Map<string, string>();
  async getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  async setItem(k: string, v: string) {
    this.data.set(k, v);
  }
  async removeItem(k: string) {
    this.data.delete(k);
  }
  async getAllKeys() {
    return [...this.data.keys()];
  }
  async multiRemove(keys: readonly string[]) {
    keys.forEach((k) => this.data.delete(k));
  }
}
