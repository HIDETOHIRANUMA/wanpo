import type { Area, Station } from '@/domain/types';

/**
 * 初期エリアと登録駅。エリア追加はこの一覧（本番は areas / stations テーブル）への追加で対応する。
 * 座標は概略値。本番投入前に公的な資料で確認すること。
 */
export const AREAS: Area[] = [
  { id: 'shinagawa', name: '品川区', prefecture: '東京都', lat: 35.6092, lng: 139.7302 },
  { id: 'minato', name: '港区', prefecture: '東京都', lat: 35.6581, lng: 139.7516 },
  { id: 'shibuya', name: '渋谷区', prefecture: '東京都', lat: 35.664, lng: 139.6982 },
];

export const STATIONS: Station[] = [
  { id: 'st-shinagawa', name: '品川駅', areaId: 'minato', lat: 35.6285, lng: 139.7387 },
  { id: 'st-gotanda', name: '五反田駅', areaId: 'shinagawa', lat: 35.6262, lng: 139.7236 },
  { id: 'st-osaki', name: '大崎駅', areaId: 'shinagawa', lat: 35.6197, lng: 139.7286 },
  { id: 'st-oimachi', name: '大井町駅', areaId: 'shinagawa', lat: 35.6064, lng: 139.7346 },
  { id: 'st-musashikoyama', name: '武蔵小山駅', areaId: 'shinagawa', lat: 35.6205, lng: 139.7042 },
  { id: 'st-tamachi', name: '田町駅', areaId: 'minato', lat: 35.6457, lng: 139.7476 },
  { id: 'st-hamamatsucho', name: '浜松町駅', areaId: 'minato', lat: 35.6555, lng: 139.757 },
  { id: 'st-roppongi', name: '六本木駅', areaId: 'minato', lat: 35.6628, lng: 139.7314 },
  { id: 'st-azabujuban', name: '麻布十番駅', areaId: 'minato', lat: 35.6564, lng: 139.7368 },
  { id: 'st-hiroo', name: '広尾駅', areaId: 'shibuya', lat: 35.6518, lng: 139.7222 },
  { id: 'st-shibuya', name: '渋谷駅', areaId: 'shibuya', lat: 35.658, lng: 139.7016 },
  { id: 'st-ebisu', name: '恵比寿駅', areaId: 'shibuya', lat: 35.6467, lng: 139.7101 },
  { id: 'st-omotesando', name: '表参道駅', areaId: 'minato', lat: 35.6652, lng: 139.7123 },
  { id: 'st-yoyogiuehara', name: '代々木上原駅', areaId: 'shibuya', lat: 35.669, lng: 139.6797 },
];

/** 初期表示の基準点：対象エリア（品川区・港区・渋谷区）の中心付近 */
export const ALL_AREA_ORIGIN = {
  kind: 'area' as const,
  label: '対象エリア（品川区・港区・渋谷区）の中心付近',
  lat: 35.6405,
  lng: 139.7265,
};
