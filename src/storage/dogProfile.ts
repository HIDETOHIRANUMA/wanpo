import { CARRY_METHODS, EMPTY_DOG_PROFILE, type DogProfile, type Tri } from '@/domain/types';
import type { LocalStore } from './localStore';

const KEY = 'dog-profile';

/** 保存値を検証して読み込む。壊れた値・未知の値は「不明」に戻す（制限なしと解釈しない） */
export function sanitizeProfile(raw: unknown): DogProfile | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const name = typeof r.name === 'string' && r.name.trim() ? r.name.trim().slice(0, 30) : null;
  const w = typeof r.weightKg === 'number' && Number.isFinite(r.weightKg) && r.weightKg > 0 && r.weightKg < 120 ? r.weightKg : null;
  const methods = Array.isArray(r.carryMethods)
    ? CARRY_METHODS.filter((m) => (r.carryMethods as unknown[]).includes(m))
    : [];
  const cert: Tri = r.canBringCertificate === 'yes' || r.canBringCertificate === 'no' ? r.canBringCertificate : 'unknown';
  return { name, weightKg: w, carryMethods: methods, canBringCertificate: cert };
}

export class DogProfileStore {
  constructor(private store: LocalStore) {}

  /** 未作成なら null（プロフィールなしでもアプリは使える） */
  async load(): Promise<DogProfile | null> {
    return sanitizeProfile(await this.store.getJson(KEY));
  }

  async save(p: DogProfile): Promise<DogProfile> {
    const clean = sanitizeProfile(p) ?? EMPTY_DOG_PROFILE;
    await this.store.setJson(KEY, clean);
    return clean;
  }

  async clear(): Promise<void> {
    await this.store.remove(KEY);
  }
}
