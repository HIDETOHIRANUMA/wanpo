export interface LatLng {
  lat: number;
  lng: number;
}

/** 2点間の直線距離（km）。徒歩時間は推測しない */
export function distanceKm(a: LatLng, b: LatLng): number {
  const R = 6371.0088;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.max(10, Math.round((km * 1000) / 10) * 10)}m`;
  return `${km.toFixed(1)}km`;
}

/** 日本付近の座標として妥当か（投入時の検証用） */
export function isValidJapanCoord(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) && Number.isFinite(lng) && lat >= 20 && lat <= 46 && lng >= 122 && lng <= 154
  );
}
