/**
 * 利用者の投稿（口コミ・犬の写真）。
 * 投稿は施設の確認記録・判定条件を変えない（判定は運営の確認情報だけで行う）。
 */

export type UgcStatus = 'pending' | 'approved' | 'rejected' | 'hidden';

export type ReviewTag =
  | 'cool_inside'
  | 'staff_friendly'
  | 'water_served'
  | 'spacious'
  | 'quiet'
  | 'crowded'
  | 'dog_menu'
  | 'many_dogs';

export const REVIEW_TAGS: ReviewTag[] = [
  'cool_inside',
  'staff_friendly',
  'water_served',
  'spacious',
  'quiet',
  'crowded',
  'dog_menu',
  'many_dogs',
];

export const REVIEW_TAG_LABEL: Record<ReviewTag, string> = {
  cool_inside: '店内が涼しかった',
  staff_friendly: 'スタッフが犬に優しい',
  water_served: '水をもらえた',
  spacious: '席が広い',
  quiet: '落ち着いている',
  crowded: '混んでいた',
  dog_menu: '犬用メニューあり',
  many_dogs: '犬連れが多い',
};

export interface Review {
  id: string;
  placeId: string;
  nickname: string;
  body: string;
  tags: ReviewTag[];
  visitedOn: string | null; // YYYY-MM-DD
  publishedAt: string | null;
  /** 自分の投稿か（自分の投稿だけ状態が分かる） */
  mine: boolean;
  status: UgcStatus;
}

export interface UserPhoto {
  id: string;
  placeId: string;
  /** 表示用URL（本番は期限つきの署名URL、デモは端末内の画像） */
  url: string;
  caption: string | null;
  publishedAt: string | null;
  mine: boolean;
  status: UgcStatus;
  storagePath: string;
}

export interface UgcCounts {
  reviewCount: number;
  photoCount: number;
}

export type FlagReason = 'wrong_info' | 'inappropriate' | 'personal_info' | 'spam' | 'other';
export const FLAG_REASONS: FlagReason[] = ['inappropriate', 'personal_info', 'wrong_info', 'spam', 'other'];
export const FLAG_REASON_LABEL: Record<FlagReason, string> = {
  inappropriate: '不適切な内容',
  personal_info: '個人情報・人の顔が写っている',
  wrong_info: '事実と違う内容',
  spam: '宣伝・スパム',
  other: 'その他',
};

export const UGC_STATUS_LABEL: Record<UgcStatus, string> = {
  pending: '確認待ち（まだ公開されていません）',
  approved: '公開中',
  rejected: '非公開（運営が確認のうえ掲載を見送りました）',
  hidden: '非表示（通報または運営の判断）',
};

export const NICKNAME_MAX = 20;
export const REVIEW_BODY_MAX = 1000;
export const PHOTO_CAPTION_MAX = 100;

export interface ReviewInput {
  requestId: string;
  placeId: string;
  nickname: string;
  body: string;
  tags: ReviewTag[];
  visitedOn: string | null;
}

export interface PhotoInput {
  requestId: string;
  placeId: string;
  caption: string;
  /** 縮小・再エンコード済み（位置情報などのメタデータなし）の JPEG */
  image: PreparedImage;
}

export interface PreparedImage {
  uri: string;
  width: number;
  height: number;
  /** デモの端末内保存用（data URI）。本番では使わない */
  dataUri?: string;
  /** JPEG の base64（本番の Storage 送信用） */
  base64?: string;
}

export interface UgcSubmitResult {
  id: string;
  status: UgcStatus;
  storedAt: 'server' | 'demo_local';
}

export type ReviewField = 'nickname' | 'body' | 'tags' | 'visitedOn';

/** サーバーと同じ条件の入力チェック（サーバー側でも必ず検証する） */
export function validateReview(i: ReviewInput, today: string): ReviewField[] {
  const errors: ReviewField[] = [];
  const nick = i.nickname.trim();
  if (nick.length < 1 || [...nick].length > NICKNAME_MAX) errors.push('nickname');
  const body = i.body.trim();
  if (body.length < 1 || [...body].length > REVIEW_BODY_MAX) errors.push('body');
  if (i.tags.length > REVIEW_TAGS.length || i.tags.some((t) => !REVIEW_TAGS.includes(t))) errors.push('tags');
  if (i.visitedOn !== null) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(i.visitedOn) || i.visitedOn > today || i.visitedOn < shiftDate(today, -730))
      errors.push('visitedOn');
  }
  return errors;
}

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 公開日時の表示（日付のみ） */
export function formatPostedDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(new Date(iso).getTime() + 9 * 3600_000);
  return `${d.getUTCFullYear()}/${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}
