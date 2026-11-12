import type { BaseJudgement, FitResult } from '@/domain/judge';
import type { Freshness } from '@/domain/verification';
import { formatJstDate } from '@/domain/verification';
import { VERIFICATION_FIELD_LABEL } from '@/domain/labels';
import type { Availability } from '@/domain/hours';

export type Tone = 'ok' | 'warn' | 'bad' | 'neutral' | 'demo';

export interface BadgeInfo {
  tone: Tone;
  label: string;
}

export function baseBadge(b: BaseJudgement): BadgeInfo {
  if (b.status === 'confirmed') return { tone: 'ok', label: '室内同伴・冷房 確認済み情報あり' };
  if (b.status === 'excluded')
    return { tone: 'bad', label: b.indoor === 'no' ? '犬は室内に入れない区画' : '犬同伴区画に冷房なし' };
  const parts = [b.indoor !== 'confirmed_yes' ? '室内同伴' : null, b.air !== 'confirmed_yes' ? '冷房' : null].filter(Boolean);
  return { tone: 'warn', label: `${parts.join('・')}は未確認` };
}

export function fitBadge(r: FitResult): BadgeInfo {
  switch (r) {
    case 'match':
      return { tone: 'ok', label: '登録条件に一致' };
    case 'mismatch':
      return { tone: 'bad', label: '登録条件に不一致' };
    case 'needs_check':
      return { tone: 'warn', label: '確認が必要' };
  }
}

export function freshnessText(f: Freshness): BadgeInfo {
  if (f.status === 'unverified')
    return {
      tone: 'warn',
      label: `未確認：${f.missingFields.map((x) => VERIFICATION_FIELD_LABEL[x]).join('・')}`,
    };
  const date = formatJstDate(f.oldestKeyVerifiedAt!);
  if (f.status === 'stale') return { tone: 'warn', label: `確認日 ${date}・再確認をおすすめ` };
  return { tone: 'neutral', label: `確認日 ${date}` };
}

export function availabilityBadge(a: Availability): BadgeInfo {
  if (a === 'open') return { tone: 'ok', label: '営業時間上は営業中' };
  if (a === 'closed') return { tone: 'neutral', label: '営業時間上は営業時間外' };
  return { tone: 'warn', label: '営業時間は未確認' };
}
