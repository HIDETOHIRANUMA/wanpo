/**
 * 環境省 熱中症予防情報サイトの「地点一覧（wbgt_point_master-*.csv）」から、
 * 予測を出している地点（終了していないもの）を取り出す。
 * 列：地方,振興局,地点番号,観測所名,よみがな,ローマ字表記,所在地,Latitude(deg),Latitude(min),Longitude(deg),Longitude(min),Start,End,…
 */
import { parseCsv } from './validate';

export interface WbgtPointInput {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

/** UTF-8 として読めなければ Shift_JIS として読む */
export function decodeCsvBytes(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^﻿/, '');
  } catch {
    return new TextDecoder('shift_jis').decode(bytes);
  }
}

export function parseWbgtPointMaster(text: string, today: string): { points: WbgtPointInput[]; skipped: { ref: string; reason: string }[] } {
  const rows = parseCsv(text);
  const skipped: { ref: string; reason: string }[] = [];
  if (rows.length === 0) return { points: [], skipped: [{ ref: 'header', reason: 'empty' }] };
  const head = Object.keys(rows[0]);
  const find = (re: RegExp) => head.findIndex((h) => re.test(h));
  const iId = find(/地点番号/);
  const iName = find(/観測所名|地点名/);
  const iLat = find(/^Latitude/i);
  const iLng = find(/^Longitude/i);
  const iEnd = find(/^End/i);
  if (iId < 0 || iName < 0 || iLat < 0 || iLng < 0) {
    return { points: [], skipped: [{ ref: 'header', reason: `必要な列がありません（${head.join(',')}）` }] };
  }
  const points = new Map<string, WbgtPointInput>();
  rows.forEach((r, n) => {
    const v = head.map((h) => (r[h] ?? '').trim());
    const ref = `行${n + 2}`;
    const id = v[iId];
    if (!/^\d{5}$/.test(id)) return skipped.push({ ref, reason: `地点番号が不正（${id}）` });
    const end = iEnd >= 0 ? v[iEnd] : '';
    if (end && !end.startsWith('9999') && /^\d{4}-\d{2}-\d{2}$/.test(end) && end < today) {
      return skipped.push({ ref: id, reason: `終了済み（${end}）` });
    }
    const lat = Number(v[iLat]) + Number(v[iLat + 1] || 0) / 60;
    const lng = Number(v[iLng]) + Number(v[iLng + 1] || 0) / 60;
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 20 || lat > 46 || lng < 122 || lng > 154) {
      return skipped.push({ ref: id, reason: '緯度経度が範囲外' });
    }
    const name = v[iName].slice(0, 40);
    if (!name) return skipped.push({ ref: id, reason: '観測所名なし' });
    points.set(id, { id, name, lat: Math.round(lat * 1e5) / 1e5, lng: Math.round(lng * 1e5) / 1e5 });
  });
  return { points: [...points.values()], skipped };
}

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;

export function wbgtPointsToSql(points: WbgtPointInput[]): string {
  if (points.length === 0) return '-- 地点なし\n';
  const values = points.map((p) => `  (${q(p.id)}, ${q(p.name)}, ${p.lat}, ${p.lng})`).join(',\n');
  return [
    'begin;',
    'insert into public.wbgt_points (id, name, lat, lng) values',
    values,
    'on conflict (id) do update set name = excluded.name, lat = excluded.lat, lng = excluded.lng;',
    `delete from public.wbgt_points where id not in (${points.map((p) => q(p.id)).join(', ')});`,
    'commit;',
    '',
  ].join('\n');
}
