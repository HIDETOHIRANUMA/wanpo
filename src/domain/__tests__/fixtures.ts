import type { DogProfile, DogZone, Place, UsageConditions, Verification, Weekday } from '../types';

/** テストの基準時刻（固定）：2026-07-15(水) 12:00 JST */
export const NOW = new Date('2026-07-15T03:00:00Z');

export const allWeek = (periods: { openMin: number; closeMin: number }[]) => {
  const byWeekday: Partial<Record<Weekday, typeof periods>> = {};
  ([0, 1, 2, 3, 4, 5, 6] as Weekday[]).forEach((d) => (byWeekday[d] = periods));
  return { status: 'confirmed' as const, byWeekday };
};

export function verified(fields: Verification['field'][], at = '2026-07-01T00:00:00Z'): Verification[] {
  return fields.map((f, i) => ({ id: `v${i}-${f}`, field: f, method: 'phone', verifiedAt: at }));
}

export function makePlace(o: {
  id?: string;
  zone?: Partial<DogZone>;
  usage?: Partial<UsageConditions>;
  verifications?: Verification[];
  lat?: number;
  lng?: number;
  extra?: Partial<Place>;
} = {}): Place {
  return {
    id: o.id ?? 'p1',
    name: 'テスト施設',
    category: 'cafe',
    address: '東京都港区',
    areaId: 'minato',
    lat: o.lat ?? 35.65,
    lng: o.lng ?? 139.74,
    timezone: 'Asia/Tokyo',
    publicationStatus: 'published',
    operatingStatus: 'normal',
    zone: {
      id: 'z',
      name: '店内',
      scope: 'indoor_whole',
      indoorDogs: 'yes',
      airConditioning: 'yes',
      weightLimit: { kind: 'none' },
      carry: { status: 'confirmed', allowed: ['leash_floor'] },
      certificate: { status: 'not_required' },
      extraRequirements: [],
      ...o.zone,
    },
    usage: {
      eligibility: 'open',
      orderRequired: 'no',
      reservationRequired: 'no',
      fee: 'free',
      water: 'yes',
      ...o.usage,
    },
    businessHours: { weekly: allWeek([{ openMin: 600, closeMin: 1140 }]), exceptions: [] },
    dogHours: { mode: 'same_as_business' },
    verifications: o.verifications ?? verified(['indoor_dogs', 'air_conditioning', 'dog_conditions']),
    isDemo: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...o.extra,
  };
}

export const dog = (o: Partial<DogProfile> = {}): DogProfile => ({
  name: 'ポチ',
  weightKg: 5,
  carryMethods: ['leash_floor'],
  canBringCertificate: 'yes',
  ...o,
});
