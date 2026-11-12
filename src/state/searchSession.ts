import { useSyncExternalStore } from 'react';
import { DEFAULT_ORIGIN } from '@/data/demo/areas';
import type { SearchOrigin } from '@/domain/search';

/**
 * 探す画面で選んでいる基準点を、ほかの画面（いますぐ涼みたい・お散歩プラン）と共有する。
 * メモリ上だけに持つ（現在地を端末にもサーバーにも保存しない）。
 */
let current: SearchOrigin = DEFAULT_ORIGIN;
const listeners = new Set<() => void>();

export function setSessionOrigin(o: SearchOrigin): void {
  current = o;
  listeners.forEach((l) => l());
}

export function getSessionOrigin(): SearchOrigin {
  return current;
}

export function useSessionOrigin(): SearchOrigin {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
    () => current,
  );
}
