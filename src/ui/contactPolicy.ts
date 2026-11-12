import { directionsUrl, normalizePhone, validateHttpsUrl, type MapPlatform } from '@/domain/contact';
import type { Place } from '@/domain/types';

export type SourceKind = 'live' | 'cached' | 'unavailable';

export interface ContactActions {
  /** null のとき無効。blockedReason か、データなしの理由を表示する */
  telUrl: string | null;
  officialUrl: string | null;
  reservationUrl: string | null;
  directionsUrl: string | null;
  blockedReason: string | null;
}

/**
 * 電話・公式サイト・予約ページ・経路を有効にしてよいか。
 * - デモ施設は常に無効（架空の施設へ案内しない）
 * - 取得は成功したが掲載が見つからない（unavailable）ときは、キャッシュからの電話・経路を無効
 * - 実データがあり形式が正しい場合だけ有効
 */
export function contactActions(place: Place, opts: { isDemoMode: boolean; source: SourceKind; platform: MapPlatform }): ContactActions {
  const blockedReason =
    opts.isDemoMode || place.isDemo
      ? 'デモデータのため、電話・公式サイト・予約ページ・経路案内は使えません'
      : opts.source === 'unavailable'
        ? '現在の掲載情報を確認できないため使えません'
        : null;
  if (blockedReason) return { telUrl: null, officialUrl: null, reservationUrl: null, directionsUrl: null, blockedReason };
  const phone = normalizePhone(place.phone);
  return {
    telUrl: phone ? `tel:${phone}` : null,
    officialUrl: validateHttpsUrl(place.officialUrl),
    reservationUrl: validateHttpsUrl(place.reservationUrl),
    directionsUrl: directionsUrl(place.lat, place.lng, opts.platform),
    blockedReason: null,
  };
}
