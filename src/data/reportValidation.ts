import { toJst } from '@/domain/hours';
import { REPORT_BODY_MAX, type ReportInput } from './repository';

export const TARGET_FIELDS = [
  'dog_zone',
  'indoor_dogs',
  'air_conditioning',
  'dog_conditions',
  'usage_conditions',
  'hours',
  'contact',
  'closed',
  'other',
] as const;

export const VOTE_CHOICES = ['indoor_ok', 'cart_or_bag_needed', 'terrace_only', 'not_allowed', 'unsure'] as const;

/** クライアント側の入力検証（サーバー側の submit_place_report でも同じ内容を再検証する） */
export function validateReportInput(i: ReportInput, now: Date): string[] {
  const e: string[] = [];
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(i.requestId)) e.push('requestId');
  if (!i.placeId) e.push('placeId');
  const body = i.body.trim();
  if (i.type === 'correction') {
    if (!i.targetField || !(TARGET_FIELDS as readonly string[]).includes(i.targetField)) e.push('targetField');
    if (body.length < 1) e.push('body_required');
  } else if (i.type === 'dog_ok_vote') {
    if (!i.voteChoice || !(VOTE_CHOICES as readonly string[]).includes(i.voteChoice)) e.push('voteChoice');
  } else e.push('type');
  if (body.length > REPORT_BODY_MAX) e.push('body_too_long');
  if (i.visitedOn !== null) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(i.visitedOn)) e.push('visitedOn');
    else {
      const today = toJst(now).date;
      if (i.visitedOn > today) e.push('visitedOn_future');
    }
  }
  return e;
}
