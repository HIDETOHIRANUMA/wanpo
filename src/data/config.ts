import type { DataMode } from './repository';
import { DEFAULT_SETTINGS, type AppSettings } from '@/domain/verification';

/**
 * EXPO_PUBLIC_* はビルド時にアプリへ埋め込まれ、誰でも読める。
 * ここに置いてよいのは Supabase URL と publishable key（RLS で保護）だけ。
 */
export interface AppConfig {
  mode: DataMode;
  supabaseUrl: string | null;
  supabaseKey: string | null;
  settings: AppSettings;
  /** 本番モードで設定が不足しているか（デモへ自動で切り替えない） */
  configError: string | null;
  /** 運営者名とお問い合わせ先（ストア審査で必要。公開してよい情報だけを入れる） */
  operatorName: string | null;
  supportEmail: string | null;
}

export function readConfig(env: Record<string, string | undefined>): AppConfig {
  const rawMode = (env.EXPO_PUBLIC_DATA_MODE ?? 'demo').trim();
  const mode: DataMode = rawMode === 'production' ? 'production' : 'demo';
  const url = env.EXPO_PUBLIC_SUPABASE_URL?.trim() || null;
  const key = env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() || null;
  const stale = Number(env.EXPO_PUBLIC_STALE_AFTER_DAYS);
  const settings: AppSettings = {
    staleAfterDays: Number.isFinite(stale) && stale > 0 ? stale : DEFAULT_SETTINGS.staleAfterDays,
  };

  let configError: string | null = null;
  if (rawMode !== 'demo' && rawMode !== 'production') configError = `EXPO_PUBLIC_DATA_MODE が不正です: ${rawMode}`;
  if (mode === 'production') {
    if (!url || !/^https:\/\//.test(url)) configError = 'EXPO_PUBLIC_SUPABASE_URL が未設定または https ではありません';
    else if (!key) configError = 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY が未設定です';
    else if (/^sb_secret_/.test(key) || /service_role/.test(decodeJwtRole(key) ?? ''))
      configError = '秘密鍵がクライアント設定に含まれています。publishable key を使ってください';
  }
  const operatorName = env.EXPO_PUBLIC_OPERATOR_NAME?.trim() || null;
  const rawEmail = env.EXPO_PUBLIC_SUPPORT_EMAIL?.trim() || null;
  const supportEmail = rawEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail) ? rawEmail : null;
  return { mode, supabaseUrl: url, supabaseKey: key, settings, configError, operatorName, supportEmail };
}

/** 旧形式（JWT）のキーが service_role でないかを確認する */
function decodeJwtRole(key: string): string | null {
  const parts = key.split('.');
  if (parts.length !== 3) return null;
  try {
    const json = globalThis.atob ? globalThis.atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')) : '';
    return JSON.parse(json).role ?? null;
  } catch {
    return null;
  }
}

export const appConfig: AppConfig = readConfig({
  // Expo は process.env.EXPO_PUBLIC_* をドット記法でのみ静的に置き換える
  EXPO_PUBLIC_DATA_MODE: process.env.EXPO_PUBLIC_DATA_MODE,
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  EXPO_PUBLIC_STALE_AFTER_DAYS: process.env.EXPO_PUBLIC_STALE_AFTER_DAYS,
  EXPO_PUBLIC_OPERATOR_NAME: process.env.EXPO_PUBLIC_OPERATOR_NAME,
  EXPO_PUBLIC_SUPPORT_EMAIL: process.env.EXPO_PUBLIC_SUPPORT_EMAIL,
});
