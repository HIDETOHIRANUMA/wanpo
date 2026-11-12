import type { Review } from '@/domain/ugc';

/**
 * デモ用の架空の口コミ（実在の利用者・店舗の声ではない）。
 * 写真は実在の店舗写真に見える画像を使わないため、あらかじめ用意しない（利用者が端末内で試せる）。
 */
export function createDemoReviews(now: Date): Review[] {
  const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000).toISOString();
  const r = (id: string, placeId: string, nickname: string, body: string, tags: Review['tags'], d: number): Review => ({
    id,
    placeId,
    nickname,
    body,
    tags,
    visitedOn: daysAgo(d + 1).slice(0, 10),
    publishedAt: daysAgo(d),
    mine: false,
    status: 'approved',
  });
  return [
    r('demo-rv-01', 'demo-01', 'デモ：むぎママ', '（デモの架空の口コミ）お昼すぎでも店内がしっかり涼しく、床に伏せて休めました。', ['cool_inside', 'water_served'], 3),
    r('demo-rv-02', 'demo-01', 'デモ：こたろう', '（デモの架空の口コミ）ソファ席の横に犬用マットがありました。', ['staff_friendly', 'spacious'], 12),
    r('demo-rv-03', 'demo-04', 'デモ：まめ', '（デモの架空の口コミ）小型犬連れが多く、落ち着いて過ごせました。', ['many_dogs', 'quiet'], 5),
    r('demo-rv-04', 'demo-05', 'デモ：ラテ', '（デモの架空の口コミ）カートのまま入れるので移動の合間の休憩に便利。', ['spacious'], 8),
    r('demo-rv-05', 'demo-10', 'デモ：よるさんぽ', '（デモの架空の口コミ）夜の散歩帰りに寄れて助かります。週末は混みます。', ['crowded'], 2),
    r('demo-rv-06', 'demo-21', 'デモ：なにわのポチ', '（デモの架空の口コミ）川沿いの散歩のあとに涼めました。', ['cool_inside', 'dog_menu'], 6),
    r('demo-rv-07', 'demo-25', 'デモ：ゆきみ', '（デモの架空の口コミ）夏でも冷房がよく効いていました。', ['cool_inside', 'quiet'], 9),
  ];
}
