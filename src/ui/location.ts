import * as Location from 'expo-location';
import type { LatLng } from '@/domain/geo';

export type LocationResult =
  | { ok: true; coords: LatLng }
  | { ok: false; reason: 'denied' | 'timeout' | 'unavailable' };

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | 'timeout'> {
  return Promise.race([p, new Promise<'timeout'>((r) => setTimeout(() => r('timeout'), ms))]);
}

/**
 * 利用者が「現在地から探す」を押したときだけ呼ぶ。1回だけ取得し、保存・送信・ログ出力しない。
 * バックグラウンド取得や継続的な追跡はしない。
 */
export async function getCurrentLocationOnce(timeoutMs = 10_000): Promise<LocationResult> {
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') return { ok: false, reason: 'denied' };
    const pos = await withTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), timeoutMs);
    if (pos === 'timeout') return { ok: false, reason: 'timeout' };
    return { ok: true, coords: { lat: pos.coords.latitude, lng: pos.coords.longitude } };
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
}

export const LOCATION_FAILURE_MESSAGE: Record<'denied' | 'timeout' | 'unavailable', string> = {
  denied: '位置情報の利用が許可されていません。エリアまたは駅を選んで探せます。（許可は端末の設定から変更できます）',
  timeout: '現在地を時間内に取得できませんでした。エリアまたは駅を選んで探せます。',
  unavailable: '現在地を取得できませんでした。エリアまたは駅を選んで探せます。',
};
