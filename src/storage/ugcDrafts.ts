import type { ReviewInput } from '@/domain/ugc';
import type { LocalStore } from './localStore';

/** 口コミの下書き。ログイン前の入力と送信失敗時の内容を保持する（送信成功で削除） */
export interface ReviewDraft extends ReviewInput {
  updatedAt: string;
}

const key = (placeId: string) => `review-draft:${placeId}`;
const NICK_KEY = 'review-nickname';

export class ReviewDraftStore {
  constructor(private store: LocalStore) {}
  load(placeId: string): Promise<ReviewDraft | null> {
    return this.store.getJson<ReviewDraft>(key(placeId));
  }
  save(d: ReviewDraft): Promise<void> {
    return this.store.setJson(key(d.placeId), d);
  }
  clear(placeId: string): Promise<void> {
    return this.store.remove(key(placeId));
  }
  /** 前回使ったニックネーム（端末内のみ） */
  async lastNickname(): Promise<string> {
    return (await this.store.getJson<string>(NICK_KEY)) ?? '';
  }
  rememberNickname(n: string): Promise<void> {
    return this.store.setJson(NICK_KEY, n);
  }
}
