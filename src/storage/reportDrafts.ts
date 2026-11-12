import type { ReportInput } from '@/data/repository';
import type { LocalStore } from './localStore';

/** 報告の下書き。ログイン（OTP）前の入力と、送信失敗時の内容を保持する */
export interface ReportDraft extends ReportInput {
  updatedAt: string;
}

const key = (placeId: string, type: string) => `report-draft:${type}:${placeId}`;

export class ReportDraftStore {
  constructor(private store: LocalStore) {}

  load(placeId: string, type: string): Promise<ReportDraft | null> {
    return this.store.getJson<ReportDraft>(key(placeId, type));
  }

  save(d: ReportDraft): Promise<void> {
    return this.store.setJson(key(d.placeId, d.type), d);
  }

  clear(placeId: string, type: string): Promise<void> {
    return this.store.remove(key(placeId, type));
  }
}
