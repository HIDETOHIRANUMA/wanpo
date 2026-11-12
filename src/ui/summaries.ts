import { CARRY_METHOD_LABEL, ELIGIBILITY_LABEL, FEE_LABEL, FLOOR_LABEL, triLabel, ZONE_SCOPE_LABEL } from '@/domain/labels';
import type { DogZone, UsageConditions } from '@/domain/types';

export function zoneSummary(z: DogZone): string {
  const scope = ZONE_SCOPE_LABEL[z.scope];
  return z.name && z.name !== scope ? `${scope}（${z.name}）` : scope;
}

export function weightText(z: DogZone): string {
  const w = z.weightLimit;
  if (w.kind === 'none') return '体重制限なし';
  if (w.kind === 'max_kg') return `${w.maxKg}kg${w.inclusive ? '以下' : '未満'}`;
  if (w.kind === 'text_only') return `「${w.text}」`;
  return '体重制限は未確認';
}

export function carryText(z: DogZone): string {
  if (z.carry.status === 'unknown') return '同伴方法は未確認';
  return z.carry.allowed.map((m) => CARRY_METHOD_LABEL[m]).join('または');
}

export function certificateText(z: DogZone): string {
  if (z.certificate.status === 'not_required') return '証明書不要';
  if (z.certificate.status === 'required') return `証明書必要${z.certificate.text ? `（${z.certificate.text}）` : ''}`;
  return '証明書要否は未確認';
}

export function dogConditionSummary(z: DogZone): string {
  const extra = z.extraRequirements.length ? ` ・追加条件あり` : '';
  return `${weightText(z)} ・${carryText(z)} ・${certificateText(z)}${extra}`;
}

export function orderText(u: UsageConditions): string {
  return u.orderRequired === 'yes' ? `注文必須${u.orderText ? `（${u.orderText}）` : ''}` : u.orderRequired === 'no' ? '注文不要' : '注文要否は未確認';
}

export function reservationText(u: UsageConditions): string {
  return u.reservationRequired === 'yes'
    ? `予約必須${u.reservationText ? `（${u.reservationText}）` : ''}`
    : u.reservationRequired === 'no'
      ? '予約不要'
      : '予約要否は未確認';
}

export function feeText(u: UsageConditions): string {
  return `${FEE_LABEL[u.fee]}${u.feeText ? `（${u.feeText}）` : ''}`;
}

export function eligibilityText(u: UsageConditions): string {
  return `${ELIGIBILITY_LABEL[u.eligibility]}${u.eligibilityText ? `（${u.eligibilityText}）` : ''}`;
}

export function waterText(u: UsageConditions): string {
  return u.water === 'yes' ? '犬用の水あり' : u.water === 'no' ? '犬用の水なし' : '犬用の水は未確認';
}

export function usageSummary(u: UsageConditions): string {
  const parts = [orderText(u), reservationText(u)];
  if (u.eligibility !== 'open') parts.push(ELIGIBILITY_LABEL[u.eligibility]);
  if (u.fee === 'paid') parts.push('料金あり');
  return parts.join(' ・');
}

export function breedText(z: DogZone): string {
  const b = z.breed;
  switch (b.status) {
    case 'none':
      return '制限なし（確認済み）';
    case 'brachycephalic_ng':
      return `短頭種は不可${b.text ? `（${b.text}）` : ''}`;
    case 'text_only':
      return b.text;
    case 'unknown':
      return '未確認';
  }
}

export function maxDogsText(z: DogZone): string {
  return z.maxDogs.kind === 'none' ? '制限なし（確認済み）' : z.maxDogs.kind === 'max' ? `1組${z.maxDogs.count}頭まで` : '未確認';
}

export function floorText(z: DogZone): string {
  return FLOOR_LABEL[z.floor];
}

export function dogMenuText(z: DogZone): string {
  return triLabel(z.dogMenu, 'あり', 'なし');
}

export function dogSeatsText(z: DogZone): string {
  return z.dogSeats === null ? '未確認' : `${z.dogSeats}席`;
}
