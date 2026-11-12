/** 電話番号・URLの形式検証と外部リンク生成（純粋関数） */

/** 国内の電話番号（数字・ハイフン・括弧、+81可）。tel: 用に数字だけへ正規化して返す */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!/^\+?[0-9()\-\s]{10,20}$/.test(s)) return null;
  const digits = s.replace(/[^0-9+]/g, '');
  const national = digits.startsWith('+81') ? `0${digits.slice(3)}` : digits;
  if (!/^0[0-9]{9,10}$/.test(national)) return null;
  return national;
}

/** https のみ許可。ユーザー情報・空白・制御文字を含むURLは拒否 */
export function validateHttpsUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim();
  if (s.length > 2000) return null;
  const m = /^https:\/\/([A-Za-z0-9.-]+)(:[0-9]{1,5})?(\/[^\s]*)?$/.exec(s);
  if (!m) return null;
  const host = m[1];
  if (!host.includes('.') || host.startsWith('.') || host.endsWith('.') || host.includes('..'))
    return null;
  return s;
}

export type MapPlatform = 'ios' | 'android' | 'web' | 'other';

/** 外部の地図アプリで目的地を開くURL。現在地は送らず、目的地座標のみを渡す */
export function directionsUrl(lat: number, lng: number, platform: MapPlatform): string {
  const dest = `${lat.toFixed(6)},${lng.toFixed(6)}`;
  if (platform === 'ios') return `https://maps.apple.com/?daddr=${dest}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${dest}`;
}
