import { KEY_VERIFICATION_FIELDS, type Verification, type VerificationField } from './types';

export interface AppSettings {
  /** 再確認をおすすめする日数。運用上の目安で、安全性の基準ではない */
  staleAfterDays: number;
}

export const DEFAULT_SETTINGS: AppSettings = { staleAfterDays: 90 };

export function latestVerification(
  verifications: Verification[],
  field: VerificationField,
): Verification | null {
  let best: Verification | null = null;
  for (const v of verifications) {
    if (v.field !== field) continue;
    if (!best || Date.parse(v.verifiedAt) > Date.parse(best.verifiedAt)) best = v;
  }
  return best;
}

export type FreshnessStatus = 'fresh' | 'stale' | 'unverified';

export interface Freshness {
  status: FreshnessStatus;
  /** 主要項目の最新確認記録のうち、最も古い確認日時（すべて揃っているときのみ） */
  oldestKeyVerifiedAt: string | null;
  missingFields: VerificationField[];
  ageDays: number | null;
}

/**
 * カード用の確認日。室内同伴・冷房・犬の条件それぞれの最新記録を取り、そのうち最も古いものを使う。
 * 店舗情報の updatedAt（写真・紹介文の編集）は参照しない。
 */
export function keyFreshness(
  verifications: Verification[],
  now: Date,
  settings: AppSettings = DEFAULT_SETTINGS,
): Freshness {
  const missing: VerificationField[] = [];
  let oldest: string | null = null;
  for (const f of KEY_VERIFICATION_FIELDS) {
    const v = latestVerification(verifications, f);
    if (!v) {
      missing.push(f);
      continue;
    }
    if (oldest === null || Date.parse(v.verifiedAt) < Date.parse(oldest)) oldest = v.verifiedAt;
  }
  if (missing.length > 0) return { status: 'unverified', oldestKeyVerifiedAt: null, missingFields: missing, ageDays: null };
  const ageDays = Math.floor((now.getTime() - Date.parse(oldest!)) / 86_400_000);
  return {
    status: ageDays > settings.staleAfterDays ? 'stale' : 'fresh',
    oldestKeyVerifiedAt: oldest,
    missingFields: [],
    ageDays,
  };
}

export function isStale(v: Verification, now: Date, settings: AppSettings = DEFAULT_SETTINGS): boolean {
  return (now.getTime() - Date.parse(v.verifiedAt)) / 86_400_000 > settings.staleAfterDays;
}

/** 表示用 YYYY/MM/DD（JST） */
export function formatJstDate(iso: string): string {
  const d = new Date(Date.parse(iso) + 9 * 3_600_000);
  const p = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${d.getUTCFullYear()}/${p(d.getUTCMonth() + 1)}/${p(d.getUTCDate())}`;
}

export function formatJstDateTime(iso: string): string {
  const d = new Date(Date.parse(iso) + 9 * 3_600_000);
  const p = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${formatJstDate(iso)} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}
