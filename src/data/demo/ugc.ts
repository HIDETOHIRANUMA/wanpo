import type { DogSize } from '@/domain/types';
import type { Review, UserPhoto } from '@/domain/ugc';
import { DOG_ILLUSTRATIONS, type DogIllustrationKey } from './dogIllustrations';

/**
 * デモ用の架空の口コミ（実在の利用者・店舗の声ではない）。
 * 写真は実在の店舗写真に見える画像を使わないため、あらかじめ用意しない（利用者が端末内で試せる）。
 */
export function createDemoReviews(now: Date): Review[] {
  const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000).toISOString();
  const r = (
    id: string,
    placeId: string,
    nickname: string,
    body: string,
    tags: Review['tags'],
    d: number,
    dogSize: DogSize | null = null,
    dogBreed: string | null = null,
  ): Review => ({
    id,
    placeId,
    nickname,
    body,
    tags,
    visitedOn: daysAgo(d + 1).slice(0, 10),
    publishedAt: daysAgo(d),
    mine: false,
    status: 'approved',
    dogSize,
    dogBreed,
  });
  return [
    r('demo-rv-01', 'demo-01', 'デモ：むぎママ', '（デモの架空の口コミ）お昼すぎでも店内がしっかり涼しく、床に伏せて休めました。', ['cool_inside', 'water_served'], 3, 'small', 'トイプードル'),
    r('demo-rv-02', 'demo-01', 'デモ：こたろう', '（デモの架空の口コミ）ソファ席の横に犬用マットがありました。', ['staff_friendly', 'spacious'], 12, 'medium', '柴犬'),
    r('demo-rv-03', 'demo-04', 'デモ：まめ', '（デモの架空の口コミ）小型犬連れが多く、落ち着いて過ごせました。', ['many_dogs', 'quiet'], 5, 'small', 'ミニチュアダックスフンド'),
    r('demo-rv-04', 'demo-05', 'デモ：ラテ', '（デモの架空の口コミ）カートのまま入れるので移動の合間の休憩に便利。', ['spacious'], 8, 'large', 'ゴールデンレトリバー'),
    r('demo-rv-05', 'demo-10', 'デモ：よるさんぽ', '（デモの架空の口コミ）夜の散歩帰りに寄れて助かります。週末は混みます。', ['crowded'], 2),
    r('demo-rv-06', 'demo-21', 'デモ：なにわのポチ', '（デモの架空の口コミ）川沿いの散歩のあとに涼めました。', ['cool_inside', 'dog_menu'], 6, 'small', 'フレンチブルドッグ'),
    r('demo-rv-07', 'demo-25', 'デモ：ゆきみ', '（デモの架空の口コミ）夏でも冷房がよく効いていました。', ['cool_inside', 'quiet'], 9),
  ];
}

/** デモ用の「犬の写真」（実際はイラスト）。author は投稿者の代わり（ブロックの確認用） */
export function createDemoPhotos(now: Date): { photo: UserPhoto; author: string }[] {
  const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000).toISOString();
  const ph = (id: string, placeId: string, key: DogIllustrationKey, caption: string, size: DogSize, breed: string, d: number, author: string) => ({
    author,
    photo: {
      id,
      placeId,
      url: DOG_ILLUSTRATIONS[key],
      caption: `${caption}（デモのイラスト）`,
      publishedAt: daysAgo(d),
      mine: false,
      status: 'approved' as const,
      storagePath: `demo/${id}.jpg`,
      dogSize: size,
      dogBreed: breed,
    },
  });
  return [
    ph('demo-ph-01', 'demo-01', 'poodle', 'ソファ席の横で休憩', 'small', 'トイプードル', 2, 'デモ：むぎママ'),
    ph('demo-ph-02', 'demo-01', 'shiba', '冷房の近くでごろり', 'medium', '柴犬', 6, 'デモ：こたろう'),
    ph('demo-ph-03', 'demo-01', 'dachs', 'お水をもらいました', 'small', 'ミニチュアダックスフンド', 9, 'デモ：まめ'),
    ph('demo-ph-04', 'demo-01', 'golden', '大きい子も入れました', 'large', 'ゴールデンレトリバー', 14, 'デモ：ラテ'),
    ph('demo-ph-05', 'demo-04', 'frenchie', 'パンの香りにそわそわ', 'small', 'フレンチブルドッグ', 4, 'デモ：ぶーちゃん'),
    ph('demo-ph-06', 'demo-07', 'collie', '天井が高くて快適', 'medium', 'ボーダーコリー', 3, 'デモ：そら'),
    ph('demo-ph-07', 'demo-07', 'golden', '広い席でのんびり', 'large', 'ゴールデンレトリバー', 10, 'デモ：ラテ'),
    ph('demo-ph-08', 'demo-28', 'poodle', 'お買い物の合間に', 'small', 'トイプードル', 1, 'デモ：むぎママ'),
    ph('demo-ph-09', 'demo-27', 'shiba', 'カートで店内をお散歩', 'medium', '柴犬', 5, 'デモ：こたろう'),
  ];
}
