import { CARRY_METHODS, EMPTY_DOG_CARD, EMPTY_DOG_PROFILE, type DogCard, type DogProfile, type Tri } from '@/domain/types';
import type { LocalStore } from './localStore';

const KEY = 'dog-profile';

const tri = (v: unknown): Tri => (v === 'yes' || v === 'no' ? v : 'unknown');
const text = (v: unknown, max: number): string | null =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;
const date = (v: unknown): string | null => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

function sanitizeCard(raw: unknown): DogCard {
  if (!raw || typeof raw !== 'object') return EMPTY_DOG_CARD;
  const r = raw as Record<string, unknown>;
  return {
    sex: r.sex === 'male' || r.sex === 'female' ? r.sex : null,
    birthMonth: typeof r.birthMonth === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(r.birthMonth) ? r.birthMonth : null,
    neutered: tri(r.neutered),
    rabiesVaccinatedOn: date(r.rabiesVaccinatedOn),
    comboVaccinatedOn: date(r.comboVaccinatedOn),
    personality: text(r.personality, 100),
    noteForStaff: text(r.noteForStaff, 100),
  };
}

/** 保存値を検証して読み込む。壊れた値・未知の値は「不明」に戻す（制限なしと解釈しない） */
export function sanitizeProfile(raw: unknown): DogProfile | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const w = typeof r.weightKg === 'number' && Number.isFinite(r.weightKg) && r.weightKg > 0 && r.weightKg < 120 ? r.weightKg : null;
  const methods = Array.isArray(r.carryMethods)
    ? CARRY_METHODS.filter((m) => (r.carryMethods as unknown[]).includes(m))
    : [];
  const count = typeof r.dogCount === 'number' && Number.isInteger(r.dogCount) && r.dogCount >= 1 && r.dogCount <= 5 ? r.dogCount : 1;
  return {
    ...EMPTY_DOG_PROFILE,
    name: text(r.name, 30),
    weightKg: w,
    carryMethods: methods,
    canBringCertificate: tri(r.canBringCertificate),
    breed: text(r.breed, 30),
    brachycephalic: tri(r.brachycephalic),
    dogCount: count,
    card: sanitizeCard(r.card),
  };
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
