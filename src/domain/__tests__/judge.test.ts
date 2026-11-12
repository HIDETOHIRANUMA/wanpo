import { EMPTY_DOG_PROFILE } from '../types';
import { judgeBase, judgeDogFit } from '../judge';
import { dog, makePlace, verified } from './fixtures';

describe('室内同伴・冷房の基本判定（同じ区画のみ）', () => {
  test('犬はテラスのみ・店内に冷房ありの施設は除外される', () => {
    // 区画（テラス）に冷房「あり」と誤入力されていても、テラスは室内同伴ではない
    const p = makePlace({ zone: { scope: 'terrace', indoorDogs: 'no', airConditioning: 'yes' } });
    expect(judgeBase(p).status).toBe('excluded');
    const p2 = makePlace({ zone: { scope: 'terrace', indoorDogs: 'yes', airConditioning: 'yes' } });
    expect(judgeBase(p2).status).toBe('excluded');
  });

  test('冷房不明は冷房ありに一致しない', () => {
    const p = makePlace({ zone: { airConditioning: 'unknown' } });
    const b = judgeBase(p);
    expect(b.air).toBe('unverified');
    expect(b.status).toBe('unconfirmed');
  });

  test('値が yes でも確認記録がなければ確認済みにしない', () => {
    const p = makePlace({ verifications: verified(['air_conditioning', 'dog_conditions']) });
    expect(judgeBase(p).status).toBe('unconfirmed');
    expect(judgeBase(p).indoor).toBe('unverified');
  });

  test('室内同伴不可または冷房なしと判明した施設は除外', () => {
    expect(judgeBase(makePlace({ zone: { indoorDogs: 'no' } })).status).toBe('excluded');
    expect(judgeBase(makePlace({ zone: { airConditioning: 'no' } })).status).toBe('excluded');
  });

  test('同じ区画で両方確認済みなら confirmed', () => {
    expect(judgeBase(makePlace()).status).toBe('confirmed');
  });
});

describe('体重制限', () => {
  const limit = (inclusive: boolean) =>
    makePlace({ zone: { weightLimit: { kind: 'max_kg', maxKg: 10, inclusive } } });

  test('上限と同値：「以下」なら一致、「未満」なら不一致', () => {
    expect(judgeDogFit(limit(true), dog({ weightKg: 10 })).result).toBe('match');
    expect(judgeDogFit(limit(false), dog({ weightKg: 10 })).result).toBe('mismatch');
  });

  test('超過は不一致', () => {
    expect(judgeDogFit(limit(true), dog({ weightKg: 10.1 })).result).toBe('mismatch');
  });

  test('犬の体重が不明なら要確認（一致にしない）', () => {
    expect(judgeDogFit(limit(true), dog({ weightKg: null })).result).toBe('needs_check');
  });

  test('施設の体重制限が未確認なら要確認', () => {
    const p = makePlace({ zone: { weightLimit: { kind: 'unknown' } } });
    expect(judgeDogFit(p, dog({ weightKg: 2 })).result).toBe('needs_check');
  });

  test('「小型犬のみ」の文章条件は、軽い犬でも一致と断定しない', () => {
    const p = makePlace({ zone: { weightLimit: { kind: 'text_only', text: '小型犬のみ' } } });
    const r = judgeDogFit(p, dog({ weightKg: 2 }));
    expect(r.result).toBe('needs_check');
    expect(r.reasons.find((x) => x.aspect === 'weight')?.message).toContain('小型犬のみ');
  });
});

describe('同伴方法（OR）と他の必須条件（AND）', () => {
  const cartOrBag = makePlace({ zone: { carry: { status: 'confirmed', allowed: ['cart', 'bag'] } } });

  test('カートまたはバッグ：どちらか一方に対応できれば一致', () => {
    expect(judgeDogFit(cartOrBag, dog({ carryMethods: ['bag'] })).result).toBe('match');
    expect(judgeDogFit(cartOrBag, dog({ carryMethods: ['cart', 'held'] })).result).toBe('match');
  });

  test('共通項がなければ不一致', () => {
    expect(judgeDogFit(cartOrBag, dog({ carryMethods: ['leash_floor', 'held'] })).result).toBe('mismatch');
  });

  test('同伴方法が未選択なら全方法対応とみなさず要確認', () => {
    expect(judgeDogFit(cartOrBag, dog({ carryMethods: [] })).result).toBe('needs_check');
  });

  test('同伴方法が一致しても、体重超過なら不一致（AND）', () => {
    const p = makePlace({
      zone: {
        carry: { status: 'confirmed', allowed: ['cart', 'bag'] },
        weightLimit: { kind: 'max_kg', maxKg: 8, inclusive: true },
      },
    });
    expect(judgeDogFit(p, dog({ carryMethods: ['cart'], weightKg: 9 })).result).toBe('mismatch');
  });

  test('同伴方法が一致しても、証明書を持参できないなら不一致（AND）', () => {
    const p = makePlace({
      zone: { carry: { status: 'confirmed', allowed: ['cart', 'bag'] }, certificate: { status: 'required' } },
    });
    expect(judgeDogFit(p, dog({ carryMethods: ['cart'], canBringCertificate: 'no' })).result).toBe('mismatch');
    expect(judgeDogFit(p, dog({ carryMethods: ['cart'], canBringCertificate: 'unknown' })).result).toBe('needs_check');
    expect(judgeDogFit(p, dog({ carryMethods: ['cart'], canBringCertificate: 'yes' })).result).toBe('match');
  });

  test('証明書要件が未確認なら要確認', () => {
    const p = makePlace({ zone: { certificate: { status: 'unknown' } } });
    expect(judgeDogFit(p, dog()).result).toBe('needs_check');
  });
});

describe('判定できない条件・利用資格・未登録', () => {
  test('「大型犬の場合だけカート必須」などの文章条件は一致と断定しない', () => {
    const p = makePlace({ zone: { extraRequirements: [{ text: '大型犬の場合はカート必須', effect: 'needs_check' }] } });
    const r = judgeDogFit(p, dog());
    expect(r.result).toBe('needs_check');
    expect(r.reasons.some((x) => x.message.includes('大型犬の場合はカート必須'))).toBe(true);
  });

  test('判定に影響しない注意事項（info）は一致を妨げない', () => {
    const p = makePlace({ zone: { extraRequirements: [{ text: '店内ではリードを短く', effect: 'info' }] } });
    expect(judgeDogFit(p, dog()).result).toBe('match');
  });

  test('宿泊者限定は厳密な一致にしない', () => {
    const p = makePlace({ usage: { eligibility: 'guests_only' } });
    expect(judgeDogFit(p, dog()).result).toBe('needs_check');
  });

  test('プロフィール未登録なら、制限なしの施設でも要確認', () => {
    const p = makePlace();
    expect(judgeDogFit(p, null).result).toBe('needs_check');
    expect(
      judgeDogFit(p, { ...EMPTY_DOG_PROFILE }).result,
    ).toBe('needs_check');
  });

  test('不一致は要確認より優先される', () => {
    const p = makePlace({
      zone: { weightLimit: { kind: 'max_kg', maxKg: 5, inclusive: true }, certificate: { status: 'unknown' } },
    });
    expect(judgeDogFit(p, dog({ weightKg: 6 })).result).toBe('mismatch');
  });
});
