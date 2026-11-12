import React from 'react';
import { MapUnavailable } from './MapUnavailable';
import type { SearchMapProps } from './SearchMap';

/** Web プレビューではネイティブ地図を使えないため、説明のみ（ダミーの地図は表示しない） */
export function SearchMap(_props: SearchMapProps) {
  return <MapUnavailable reason="この環境では地図を表示できません。一覧からお探しください。" />;
}
