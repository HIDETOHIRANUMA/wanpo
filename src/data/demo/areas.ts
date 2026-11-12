import type { Area, Station } from '@/domain/types';

/**
 * デモのエリア（市区町村）と駅。本番は areas / stations テーブル（全国分を投入）を使う。
 * 座標は概略値。
 */
export const AREAS: Area[] = [
  { id: 'shinagawa', name: '品川区', prefecture: '東京都', prefectureCode: 13, lat: 35.6092, lng: 139.7302 },
  { id: 'minato', name: '港区', prefecture: '東京都', prefectureCode: 13, lat: 35.6581, lng: 139.7516 },
  { id: 'shibuya', name: '渋谷区', prefecture: '東京都', prefectureCode: 13, lat: 35.664, lng: 139.6982 },
  { id: 'osaka-kita', name: '大阪市北区', prefecture: '大阪府', prefectureCode: 27, lat: 34.7054, lng: 135.4983 },
  { id: 'fukuoka-chuo', name: '福岡市中央区', prefecture: '福岡県', prefectureCode: 40, lat: 33.5891, lng: 130.3926 },
  { id: 'sapporo-chuo', name: '札幌市中央区', prefecture: '北海道', prefectureCode: 1, lat: 43.0554, lng: 141.3409 },
];

export const STATIONS: Station[] = [
  { id: 'st-shinagawa', name: '品川駅', areaId: 'minato', lineName: 'JR山手線ほか', lat: 35.6285, lng: 139.7387 },
  { id: 'st-gotanda', name: '五反田駅', areaId: 'shinagawa', lineName: 'JR山手線ほか', lat: 35.6262, lng: 139.7236 },
  { id: 'st-osaki', name: '大崎駅', areaId: 'shinagawa', lineName: 'JR山手線ほか', lat: 35.6197, lng: 139.7286 },
  { id: 'st-oimachi', name: '大井町駅', areaId: 'shinagawa', lineName: 'JR京浜東北線ほか', lat: 35.6064, lng: 139.7346 },
  { id: 'st-musashikoyama', name: '武蔵小山駅', areaId: 'shinagawa', lineName: '東急目黒線', lat: 35.6205, lng: 139.7042 },
  { id: 'st-tamachi', name: '田町駅', areaId: 'minato', lineName: 'JR山手線ほか', lat: 35.6457, lng: 139.7476 },
  { id: 'st-hamamatsucho', name: '浜松町駅', areaId: 'minato', lineName: 'JR山手線ほか', lat: 35.6555, lng: 139.757 },
  { id: 'st-roppongi', name: '六本木駅', areaId: 'minato', lineName: '東京メトロ日比谷線ほか', lat: 35.6628, lng: 139.7314 },
  { id: 'st-azabujuban', name: '麻布十番駅', areaId: 'minato', lineName: '東京メトロ南北線ほか', lat: 35.6564, lng: 139.7368 },
  { id: 'st-hiroo', name: '広尾駅', areaId: 'shibuya', lineName: '東京メトロ日比谷線', lat: 35.6518, lng: 139.7222 },
  { id: 'st-shibuya', name: '渋谷駅', areaId: 'shibuya', lineName: 'JR山手線ほか', lat: 35.658, lng: 139.7016 },
  { id: 'st-ebisu', name: '恵比寿駅', areaId: 'shibuya', lineName: 'JR山手線ほか', lat: 35.6467, lng: 139.7101 },
  { id: 'st-omotesando', name: '表参道駅', areaId: 'minato', lineName: '東京メトロ銀座線ほか', lat: 35.6652, lng: 139.7123 },
  { id: 'st-yoyogiuehara', name: '代々木上原駅', areaId: 'shibuya', lineName: '小田急線ほか', lat: 35.669, lng: 139.6797 },
  { id: 'st-umeda', name: '梅田駅', areaId: 'osaka-kita', lineName: 'Osaka Metro御堂筋線ほか', lat: 34.7025, lng: 135.4996 },
  { id: 'st-osaka', name: '大阪駅', areaId: 'osaka-kita', lineName: 'JR大阪環状線ほか', lat: 34.7024, lng: 135.4959 },
  { id: 'st-tenjin', name: '天神駅', areaId: 'fukuoka-chuo', lineName: '福岡市地下鉄空港線', lat: 33.5913, lng: 130.3988 },
  { id: 'st-akasaka-fukuoka', name: '赤坂駅（福岡）', areaId: 'fukuoka-chuo', lineName: '福岡市地下鉄空港線', lat: 33.5893, lng: 130.3888 },
  { id: 'st-odori', name: '大通駅', areaId: 'sapporo-chuo', lineName: '札幌市営地下鉄南北線ほか', lat: 43.0607, lng: 141.3545 },
  { id: 'st-susukino', name: 'すすきの駅', areaId: 'sapporo-chuo', lineName: '札幌市営地下鉄南北線', lat: 43.0556, lng: 141.3532 },
];

/** 初期表示の基準点（前回の基準点がないとき）：東京都心 */
export const DEFAULT_ORIGIN = {
  kind: 'area' as const,
  label: '東京都心（港区周辺）',
  lat: 35.6405,
  lng: 139.7265,
};
