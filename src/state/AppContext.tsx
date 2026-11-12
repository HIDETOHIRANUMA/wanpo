import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { appConfig, type AppConfig } from '@/data/config';
import { createDemoBackend } from '@/data/demo/DemoBackend';
import type { AuthState, Backend } from '@/data/repository';
import { createSupabaseBackend } from '@/data/supabase/SupabaseBackend';
import type { DogProfile, Place } from '@/domain/types';
import { DogProfileStore } from '@/storage/dogProfile';
import { LocalStore } from '@/storage/localStore';
import { ReportDraftStore } from '@/storage/reportDrafts';
import { SavedPlacesStore, type SavedEntry } from '@/storage/savedPlaces';

interface AppContextValue {
  config: AppConfig;
  backend: Backend;
  isDemo: boolean;
  ready: boolean;
  profile: DogProfile | null;
  saveProfile(p: DogProfile): Promise<void>;
  saved: SavedEntry[];
  isSaved(id: string): boolean;
  toggleSave(place: Place): Promise<boolean>;
  savedStore: SavedPlacesStore;
  reloadSaved(): Promise<void>;
  drafts: ReportDraftStore;
  auth: AuthState;
  clearLocalData(): Promise<void>;
}

const Ctx = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('AppProvider がありません');
  return v;
}

function buildBackend(config: AppConfig, store: LocalStore): Backend | null {
  if (config.mode === 'demo') return createDemoBackend(store);
  if (config.configError || !config.supabaseUrl || !config.supabaseKey) return null;
  return createSupabaseBackend(config.supabaseUrl, config.supabaseKey);
}

export function AppProvider({ children, fallback }: { children: React.ReactNode; fallback: React.ReactNode }) {
  const config = appConfig;
  const store = useMemo(() => new LocalStore(config.mode), [config.mode]);
  const backend = useMemo(() => buildBackend(config, store), [config, store]);
  const profileStore = useMemo(() => new DogProfileStore(store), [store]);
  const savedStore = useMemo(() => new SavedPlacesStore(store), [store]);
  const drafts = useMemo(() => new ReportDraftStore(store), [store]);

  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<DogProfile | null>(null);
  const [saved, setSaved] = useState<SavedEntry[]>([]);
  const [auth, setAuth] = useState<AuthState>({ signedIn: false, maskedEmail: null, simulated: config.mode === 'demo' });

  useEffect(() => {
    if (config.configError) {
      // 利用者には技術情報を見せず、開発ログにだけ残す
      console.warn(`[config] ${config.configError}`);
    }
  }, [config.configError]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [p, s] = await Promise.all([profileStore.load(), savedStore.list()]);
      if (!alive) return;
      setProfile(p);
      setSaved(s);
      setReady(true);
    })().catch(() => setReady(true));
    return () => {
      alive = false;
    };
  }, [profileStore, savedStore]);

  useEffect(() => {
    if (!backend) return;
    backend.auth.getState().then(setAuth).catch(() => undefined);
    return backend.auth.subscribe(setAuth);
  }, [backend]);

  const saveProfile = useCallback(
    async (p: DogProfile) => {
      setProfile(await profileStore.save(p));
    },
    [profileStore],
  );

  const toggleSave = useCallback(
    async (place: Place) => {
      const already = saved.some((e) => e.placeId === place.id);
      // 端末への書き込みが完了してから状態を更新（保存していないのに保存済みと表示しない）
      const next = already ? await savedStore.remove(place.id) : await savedStore.save(place);
      setSaved(next);
      return !already;
    },
    [saved, savedStore],
  );

  const reloadSaved = useCallback(async () => setSaved(await savedStore.list()), [savedStore]);

  const clearLocalData = useCallback(async () => {
    await store.clearMode(['demo-auth']);
    setProfile(null);
    setSaved([]);
  }, [store]);

  if (!backend) return <>{fallback}</>;

  const value: AppContextValue = {
    config,
    backend,
    isDemo: backend.mode === 'demo',
    ready,
    profile,
    saveProfile,
    saved,
    isSaved: (id) => saved.some((e) => e.placeId === id),
    toggleSave,
    savedStore,
    reloadSaved,
    drafts,
    auth,
    clearLocalData,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
