import type { CarryMethod, DogProfile, DogZone, Place, UsageConditions } from './types';
import { CARRY_METHOD_LABEL } from './labels';

/** 室内同伴・冷房の基本判定 */
export type BaseStatus =
  | 'confirmed' // 同じ区画で室内同伴可・冷房ありの確認記録がある
  | 'unconfirmed' // どちらかが未確認（記録なしを含む）
  | 'excluded'; // 室内同伴不可または冷房なしと判明

export interface BaseJudgement {
  status: BaseStatus;
  indoor: 'confirmed_yes' | 'no' | 'unverified';
  air: 'confirmed_yes' | 'no' | 'unverified';
}

/**
 * 犬同伴区画について、室内同伴と冷房を判定する。
 * - 値が yes でも確認記録（verification）がなければ「未確認」。
 * - テラス区画は室内同伴として扱わない。
 * - 施設内の別区画の情報は組み合わせない（区画オブジェクト単体で判断）。
 */
export function judgeBase(place: Pick<Place, 'zone' | 'verifications'>): BaseJudgement {
  const zone = place.zone;
  const hasRecord = (field: 'indoor_dogs' | 'air_conditioning') =>
    place.verifications.some((v) => v.field === field);

  let indoor: BaseJudgement['indoor'];
  if (zone.scope === 'terrace' || zone.indoorDogs === 'no') indoor = 'no';
  else if (zone.indoorDogs === 'yes' && hasRecord('indoor_dogs') && zone.scope !== 'unknown')
    indoor = 'confirmed_yes';
  else indoor = 'unverified';

  let air: BaseJudgement['air'];
  if (zone.airConditioning === 'no') air = 'no';
  else if (zone.airConditioning === 'yes' && hasRecord('air_conditioning')) air = 'confirmed_yes';
  else air = 'unverified';

  let status: BaseStatus;
  if (indoor === 'no' || air === 'no') status = 'excluded';
  else if (indoor === 'confirmed_yes' && air === 'confirmed_yes') status = 'confirmed';
  else status = 'unconfirmed';
  return { status, indoor, air };
}

export type FitResult = 'match' | 'mismatch' | 'needs_check';

export type FitAspect = 'profile' | 'weight' | 'carry' | 'certificate' | 'eligibility' | 'extra';

export interface FitReason {
  aspect: FitAspect;
  result: FitResult;
  message: string;
}

export interface FitJudgement {
  result: FitResult;
  reasons: FitReason[];
}

function isProfileEmpty(p: DogProfile | null): boolean {
  return (
    !p ||
    (p.weightKg === null && p.carryMethods.length === 0 && p.canBringCertificate === 'unknown')
  );
}

function fmtKg(n: number): string {
  return Number.isInteger(n) ? `${n}kg` : `${n.toFixed(1)}kg`;
}

export function judgeWeight(zone: DogZone, profile: DogProfile | null): FitReason {
  const w = zone.weightLimit;
  const weight = profile?.weightKg ?? null;
  switch (w.kind) {
    case 'none':
      return { aspect: 'weight', result: 'match', message: '体重制限なし（確認済み）' };
    case 'unknown':
      return { aspect: 'weight', result: 'needs_check', message: '体重制限の有無が未確認です' };
    case 'text_only':
      // 「小型犬」等を独自のkgへ変換しない
      return {
        aspect: 'weight',
        result: 'needs_check',
        message: `施設の記載は「${w.text}」です。体重での判定はできないため確認が必要です`,
      };
    case 'max_kg': {
      const limitText = `${fmtKg(w.maxKg)}${w.inclusive ? '以下' : '未満'}`;
      if (weight === null)
        return {
          aspect: 'weight',
          result: 'needs_check',
          message: `体重制限は${limitText}です。犬の体重が未登録のため確認が必要です`,
        };
      const ok = w.inclusive ? weight <= w.maxKg : weight < w.maxKg;
      return ok
        ? { aspect: 'weight', result: 'match', message: `体重${fmtKg(weight)}は制限（${limitText}）内です` }
        : {
            aspect: 'weight',
            result: 'mismatch',
            message: `体重${fmtKg(weight)}は制限（${limitText}）を超えています`,
          };
    }
  }
}

export function judgeCarry(zone: DogZone, profile: DogProfile | null): FitReason {
  const c = zone.carry;
  if (c.status === 'unknown' || c.allowed.length === 0)
    return { aspect: 'carry', result: 'needs_check', message: '施設が認める同伴方法が未確認です' };
  const allowedText = c.allowed.map((m) => CARRY_METHOD_LABEL[m]).join('または');
  const mine = profile?.carryMethods ?? [];
  if (mine.length === 0)
    return {
      aspect: 'carry',
      result: 'needs_check',
      message: `施設の同伴方法は「${allowedText}」です。対応できる方法が未登録のため確認が必要です`,
    };
  const common: CarryMethod[] = c.allowed.filter((m) => mine.includes(m));
  if (common.length > 0)
    return {
      aspect: 'carry',
      result: 'match',
      message: `同伴方法「${common.map((m) => CARRY_METHOD_LABEL[m]).join('・')}」で対応できます`,
    };
  return {
    aspect: 'carry',
    result: 'mismatch',
    message: `施設の同伴方法は「${allowedText}」で、登録した方法では対応できません`,
  };
}

export function judgeCertificate(zone: DogZone, profile: DogProfile | null): FitReason {
  const c = zone.certificate;
  if (c.status === 'not_required')
    return { aspect: 'certificate', result: 'match', message: '証明書の提示は不要（確認済み）' };
  if (c.status === 'unknown')
    return { aspect: 'certificate', result: 'needs_check', message: '証明書が必要かは未確認です' };
  const what = c.text ? `（${c.text}）` : '';
  const can = profile?.canBringCertificate ?? 'unknown';
  if (can === 'yes')
    return { aspect: 'certificate', result: 'match', message: `証明書${what}が必要です。持参できると登録済みです` };
  if (can === 'no')
    return { aspect: 'certificate', result: 'mismatch', message: `証明書${what}が必要ですが、持参できないと登録されています` };
  return {
    aspect: 'certificate',
    result: 'needs_check',
    message: `証明書${what}が必要です。持参できるか未登録のため確認が必要です`,
  };
}

export function judgeEligibility(usage: UsageConditions): FitReason {
  switch (usage.eligibility) {
    case 'open':
      return { aspect: 'eligibility', result: 'match', message: '利用者の限定なし（確認済み）' };
    case 'guests_only':
    case 'members_only':
    case 'other_restricted': {
      const label =
        usage.eligibility === 'guests_only'
          ? '宿泊者限定'
          : usage.eligibility === 'members_only'
            ? '会員限定'
            : '利用者限定';
      return {
        aspect: 'eligibility',
        result: 'needs_check',
        message: `${label}${usage.eligibilityText ? `（${usage.eligibilityText}）` : ''}のため、利用資格の確認が必要です`,
      };
    }
    case 'unknown':
      return { aspect: 'eligibility', result: 'needs_check', message: '利用資格が未確認です' };
  }
}

/**
 * 登録した犬の条件との一致を判定する純粋関数。
 * - 同伴方法は施設が認める方法と利用者の方法の共通項（OR）。
 * - 体重・同伴方法・証明書・利用資格・追加条件は AND。
 * - 1つでも不一致 → 不一致。不一致なし・1つでも要確認 → 要確認。すべて一致 → 一致。
 * 一致でも当日の入店・冷房稼働・空席は保証しない（文言は UI 側で注意書き）。
 */
export function judgeDogFit(
  place: Pick<Place, 'zone' | 'usage'>,
  profile: DogProfile | null,
): FitJudgement {
  const reasons: FitReason[] = [];
  if (isProfileEmpty(profile)) {
    reasons.push({
      aspect: 'profile',
      result: 'needs_check',
      message: '犬の条件が未登録です。「犬の条件」タブで登録すると判定できます',
    });
  }
  reasons.push(judgeWeight(place.zone, profile));
  reasons.push(judgeCarry(place.zone, profile));
  reasons.push(judgeCertificate(place.zone, profile));
  reasons.push(judgeEligibility(place.usage));
  for (const extra of place.zone.extraRequirements) {
    if (extra.effect === 'needs_check')
      reasons.push({
        aspect: 'extra',
        result: 'needs_check',
        message: `追加条件「${extra.text}」は自動で判定できないため確認が必要です`,
      });
  }
  let result: FitResult = 'match';
  if (reasons.some((r) => r.result === 'mismatch')) result = 'mismatch';
  else if (reasons.some((r) => r.result === 'needs_check')) result = 'needs_check';
  return { result, reasons };
}
