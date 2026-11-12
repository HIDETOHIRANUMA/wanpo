/**
 * 全国のエリア（市区町村）・駅の投入データ検証（純粋関数）。scripts/import-areas-stations.ts から使う。
 * 出典の例：市区町村＝総務省「全国地方公共団体コード」＋代表点の座標、駅＝国土数値情報「鉄道データ（N02）」。
 * 利用規約・出典表記の条件は各データの最新の規約を確認すること。
 */
import { isValidJapanCoord } from '@/domain/geo';
import { PREFECTURES } from '@/domain/prefectures';
import type { ImportError } from './validate';

export interface AreaRowIn {
  id: string;
  name: string;
  prefecture: string;
  prefecture_code: number;
  municipality_code: string | null;
  lat: number;
  lng: number;
}

export interface StationRowIn {
  id: string;
  name: string;
  area_id: string;
  line_name: string | null;
  operator: string | null;
  lat: number;
  lng: number;
}

const ID_RE = /^[a-z0-9][a-z0-9-]{1,62}$/;

export function validateAreas(rows: Record<string, string>[]): { value: AreaRowIn[]; errors: ImportError[] } {
  const errors: ImportError[] = [];
  const value: AreaRowIn[] = [];
  const seen = new Set<string>();
  rows.forEach((r, i) => {
    const ref = `areas:${i + 2}行目`;
    const err = (field: string, message: string) => errors.push({ ref, field, message });
    const id = (r.id ?? '').trim();
    if (!ID_RE.test(id)) err('id', '英小文字・数字・ハイフンで指定してください（例：osaka-kita）');
    if (seen.has(id)) err('id', '同じIDが重複しています');
    seen.add(id);
    const name = (r.name ?? '').trim();
    if (!name || name.length > 40) err('name', '市区町村名を40文字以内で入力してください');
    const code = Number(r.prefecture_code);
    const pref = PREFECTURES.find((p) => p.code === code);
    if (!pref) err('prefecture_code', '都道府県コード（1〜47）を入力してください');
    const prefecture = (r.prefecture ?? '').trim() || pref?.name || '';
    if (pref && prefecture !== pref.name) err('prefecture', `都道府県コード ${code} は「${pref.name}」です`);
    const muni = (r.municipality_code ?? '').trim() || null;
    if (muni && !/^[0-9]{5,6}$/.test(muni)) err('municipality_code', '市区町村コードは5桁または6桁の数字です');
    if (muni && pref && Number(muni.slice(0, 2)) !== code) err('municipality_code', '市区町村コードの先頭2桁が都道府県コードと一致しません');
    const lat = Number(r.lat);
    const lng = Number(r.lng);
    if (!isValidJapanCoord(lat, lng)) err('lat/lng', '日本国内の緯度経度（数値）を入力してください');
    if (!errors.some((e) => e.ref === ref) && pref)
      value.push({ id, name, prefecture, prefecture_code: code, municipality_code: muni, lat, lng });
  });
  return { value, errors };
}

export function validateStations(rows: Record<string, string>[], knownAreaIds: string[]): { value: StationRowIn[]; errors: ImportError[] } {
  const errors: ImportError[] = [];
  const value: StationRowIn[] = [];
  const seen = new Set<string>();
  const areas = new Set(knownAreaIds);
  rows.forEach((r, i) => {
    const ref = `stations:${i + 2}行目`;
    const err = (field: string, message: string) => errors.push({ ref, field, message });
    const id = (r.id ?? '').trim();
    if (!ID_RE.test(id)) err('id', '英小文字・数字・ハイフンで指定してください（例：st-umeda）');
    if (seen.has(id)) err('id', '同じIDが重複しています');
    seen.add(id);
    const name = (r.name ?? '').trim();
    if (!name || name.length > 40) err('name', '駅名を40文字以内で入力してください');
    const area_id = (r.area_id ?? '').trim();
    if (!areas.has(area_id)) err('area_id', '未登録のエリアです（先にエリアを投入してください）');
    const line_name = (r.line_name ?? '').trim() || null;
    const operator = (r.operator ?? '').trim() || null;
    if (line_name && line_name.length > 60) err('line_name', '60文字以内にしてください');
    if (operator && operator.length > 60) err('operator', '60文字以内にしてください');
    const lat = Number(r.lat);
    const lng = Number(r.lng);
    if (!isValidJapanCoord(lat, lng)) err('lat/lng', '日本国内の緯度経度（数値）を入力してください');
    if (!errors.some((e) => e.ref === ref)) value.push({ id, name, area_id, line_name, operator, lat, lng });
  });
  return { value, errors };
}

const lit = (v: string | number | null): string => (v === null ? 'null' : typeof v === 'number' ? String(v) : `'${v.replace(/'/g, "''")}'`);

/** upsert の SQL（1トランザクション）。既存のIDは名前・座標などを更新する */
export function geoToSql(areas: AreaRowIn[], stations: StationRowIn[]): string {
  const out = ['begin;'];
  for (const a of areas)
    out.push(
      `insert into public.areas (id, name, prefecture, prefecture_code, municipality_code, lat, lng) values (${[a.id, a.name, a.prefecture, a.prefecture_code, a.municipality_code, a.lat, a.lng].map(lit).join(', ')})\n` +
        '  on conflict (id) do update set name = excluded.name, prefecture = excluded.prefecture, prefecture_code = excluded.prefecture_code, municipality_code = excluded.municipality_code, lat = excluded.lat, lng = excluded.lng;',
    );
  for (const s of stations)
    out.push(
      `insert into public.stations (id, name, area_id, line_name, operator, lat, lng) values (${[s.id, s.name, s.area_id, s.line_name, s.operator, s.lat, s.lng].map(lit).join(', ')})\n` +
        '  on conflict (id) do update set name = excluded.name, area_id = excluded.area_id, line_name = excluded.line_name, operator = excluded.operator, lat = excluded.lat, lng = excluded.lng;',
    );
  out.push('commit;');
  return out.join('\n') + '\n';
}
