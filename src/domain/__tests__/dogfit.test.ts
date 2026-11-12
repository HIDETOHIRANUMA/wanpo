import { judgeBreed, judgeDogCount, judgeDogFit } from '../judge';
import { sizeFromWeight } from '../types';
import { similarity, sortBySimilarity } from '../ugc';
import { daySegments, dogDaySegments, intersectSegments } from '../hours';
import { allWeek, dog, makePlace, NOW } from './fixtures';

describe('犬種（短頭種）', () => {
  const ng = makePlace({ zone: { breed: { status: 'brachycephalic_ng', text: '夏季のみ' } } });
  test('短頭種と登録 → 不一致、そうでない → 一致、不明 → 要確認', () => {
    expect(judgeDogFit(ng, dog({ brachycephalic: 'yes' })).result).toBe('mismatch');
    expect(judgeDogFit(ng, dog({ brachycephalic: 'no' })).result).toBe('match');
    expect(judgeDogFit(ng, dog({ brachycephalic: 'unknown' })).result).toBe('needs_check');
  });
  test('制限の有無が不明なら、短頭種の犬だけ要確認（それ以外は判定に出さない）', () => {
    const unknown = makePlace({ zone: { breed: { status: 'unknown' } } });
    expect(judgeBreed(unknown.zone, dog({ brachycephalic: 'no' }))).toBeNull();
    expect(judgeBreed(unknown.zone, dog({ brachycephalic: 'yes' }))?.result).toBe('needs_check');
  });
  test('文章だけの条件は要確認', () => {
    const t = makePlace({ zone: { breed: { status: 'text_only', text: '大型の闘犬種は不可' } } });
    expect(judgeDogFit(t, dog()).result).toBe('needs_check');
  });
});

describe('頭数', () => {
  const two = makePlace({ zone: { maxDogs: { kind: 'max', count: 2 } } });
  test('1頭なら判定に出さない', () => {
    expect(judgeDogCount(two.zone, dog({ dogCount: 1 }))).toBeNull();
  });
  test('上限以内 → 一致、超過 → 不一致、不明 → 要確認', () => {
    expect(judgeDogFit(two, dog({ dogCount: 2 })).result).toBe('match');
    expect(judgeDogFit(two, dog({ dogCount: 3 })).result).toBe('mismatch');
    expect(judgeDogFit(makePlace({ zone: { maxDogs: { kind: 'unknown' } } }), dog({ dogCount: 2 })).result).toBe('needs_check');
  });
});

test('体重から大きさの目安', () => {
  expect(sizeFromWeight(null)).toBeNull();
  expect(sizeFromWeight(9.9)).toBe('small');
  expect(sizeFromWeight(10)).toBe('medium');
  expect(sizeFromWeight(25)).toBe('large');
});

describe('似た犬の投稿', () => {
  const items = [
    { id: 'a', dogSize: 'large' as const, dogBreed: null },
    { id: 'b', dogSize: 'small' as const, dogBreed: 'トイ プードル' },
    { id: 'c', dogSize: 'small' as const, dogBreed: null },
    { id: 'd', dogSize: null, dogBreed: null },
  ];
  test('犬種が同じ（表記ゆれ吸収）＞大きさが同じ＞その他。同点は元の順', () => {
    expect(similarity(items[1], { size: 'small', breed: 'トイプードル' })).toBe(3);
    expect(sortBySimilarity(items, { size: 'small', breed: 'ﾄｲﾌﾟｰﾄﾞﾙ' }).map((x) => x.id)).toEqual(['b', 'c', 'a', 'd']);
  });
});

describe('1日のタイムライン用の時間帯', () => {
  test('前日からの日またぎ分を含める', () => {
    const p = makePlace({ extra: { businessHours: { weekly: allWeek([{ openMin: 1080, closeMin: 1560 }]), exceptions: [] } } });
    expect(daySegments(p.businessHours, NOW)).toEqual([
      { startMin: 0, endMin: 120 },
      { startMin: 1080, endMin: 1440 },
    ]);
  });
  test('犬と過ごせる時間＝営業時間と犬同伴時間の重なり。不明なら null', () => {
    const p = makePlace({ extra: { dogHours: { mode: 'custom', schedule: { weekly: allWeek([{ openMin: 780, closeMin: 1320 }]), exceptions: [] } } } });
    expect(dogDaySegments(p, NOW)).toEqual([{ startMin: 780, endMin: 1140 }]);
    expect(dogDaySegments({ ...p, dogHours: { mode: 'unknown' } }, NOW)).toBeNull();
    expect(intersectSegments([{ startMin: 0, endMin: 100 }], [{ startMin: 50, endMin: 200 }])).toEqual([{ startMin: 50, endMin: 100 }]);
  });
});
