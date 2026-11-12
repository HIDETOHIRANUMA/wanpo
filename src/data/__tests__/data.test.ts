import { EMPTY_DOG_PROFILE } from '@/domain/types';
import { readConfig } from '../config';
import { createDemoBackend, DEMO_EXPIRED_CODE, DEMO_OTP_CODE, DemoRepository } from '../demo/DemoBackend';
import { RepoError, type PlaceRepository, type ReportInput } from '../repository';
import { mapPlace, mapZone } from '../supabase/mappers';
import type { PlaceRow } from '../supabase/dbTypes';
import { contactActions } from '@/ui/contactPolicy';
import { DogProfileStore } from '@/storage/dogProfile';
import { LocalStore, MemoryKV } from '@/storage/localStore';
import { SavedPlacesStore } from '@/storage/savedPlaces';
import { makePlace, NOW } from '@/domain/__tests__/fixtures';

describe('設定（デモ／本番の切り替え）', () => {
  test('未指定はデモ', () => {
    expect(readConfig({}).mode).toBe('demo');
  });
  test('本番で設定不足ならエラー（デモへ自動で切り替えない）', () => {
    const c = readConfig({ EXPO_PUBLIC_DATA_MODE: 'production' });
    expect(c.mode).toBe('production');
    expect(c.configError).not.toBeNull();
  });
  test('秘密鍵をクライアント設定に入れると拒否', () => {
    const c = readConfig({ EXPO_PUBLIC_DATA_MODE: 'production', EXPO_PUBLIC_SUPABASE_URL: 'https://x.supabase.co', EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_abc' });
    expect(c.configError).toMatch(/秘密鍵/);
  });
  test('publishable key なら OK。再確認日数は設定可能', () => {
    const c = readConfig({ EXPO_PUBLIC_DATA_MODE: 'production', EXPO_PUBLIC_SUPABASE_URL: 'https://x.supabase.co', EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_abc', EXPO_PUBLIC_STALE_AFTER_DAYS: '60' });
    expect(c.configError).toBeNull();
    expect(c.settings.staleAfterDays).toBe(60);
  });
});

describe('デモ', () => {
  test('未公開のデモ施設は一覧・詳細に出ない', async () => {
    const repo = new DemoRepository(NOW, 0);
    const list = await repo.listPlacesNear({ lat: 35.64, lng: 139.73 }, 3000);
    expect(list.length).toBeGreaterThanOrEqual(18);
    expect(list.some((p) => p.id === 'demo-12')).toBe(false);
    expect(await repo.getPlace('demo-12')).toBeNull();
    expect(list.every((p) => p.isDemo && p.name.startsWith('デモ・'))).toBe(true);
  });

  test('要求されたケースがデモデータに含まれる', async () => {
    const all = await new DemoRepository(NOW, 0).listPlacesNear({ lat: 35.64, lng: 139.73 }, 3000);
    const has = (pred: (p: (typeof all)[number]) => boolean) => expect(all.some(pred)).toBe(true);
    has((p) => p.zone.scope === 'terrace');
    has((p) => p.zone.airConditioning === 'unknown');
    has((p) => p.zone.weightLimit.kind === 'max_kg');
    has((p) => p.zone.carry.status === 'confirmed' && p.zone.carry.allowed.join() === 'cart,bag');
    has((p) => p.usage.orderRequired === 'yes');
    has((p) => p.usage.eligibility === 'guests_only');
    has((p) => p.businessHours.weekly.status === 'unknown');
    has((p) => Object.values(p.businessHours.weekly.byWeekday).some((ps) => ps!.some((x) => x.closeMin > 1440)));
    has((p) => p.businessHours.exceptions.some((e) => e.closed));
  });

  test('デモ施設の電話・公式サイト・経路は無効（URLを作らない）', async () => {
    const p = (await new DemoRepository(NOW, 0).getPlace('demo-01'))!;
    expect(p.phone).toBeTruthy();
    const a = contactActions(p, { isDemoMode: true, source: 'live', platform: 'ios' });
    expect(a).toEqual({ telUrl: null, officialUrl: null, reservationUrl: null, directionsUrl: null, blockedReason: expect.stringContaining('デモ') });
  });

  test('本番でも掲載を確認できない保存施設は電話・経路を無効', () => {
    const p = makePlace({ extra: { phone: '03-1234-5678', officialUrl: 'https://example.com' } });
    expect(contactActions(p, { isDemoMode: false, source: 'unavailable', platform: 'android' }).telUrl).toBeNull();
    const live = contactActions(p, { isDemoMode: false, source: 'live', platform: 'android' });
    expect(live.telUrl).toBe('tel:0312345678');
    expect(live.officialUrl).toBe('https://example.com');
    // キャッシュ表示（通信エラー）は掲載終了とは区別し、無効化しない
    expect(contactActions(p, { isDemoMode: false, source: 'cached', platform: 'android' }).telUrl).toBe('tel:0312345678');
  });

  test('デモの認証は模擬。誤ったコード・期限切れは失敗、報告は端末内保存で重複しない', async () => {
    const store = new LocalStore('demo', new MemoryKV());
    const b = createDemoBackend(store, NOW);
    const input: ReportInput = { requestId: '0b0b0b0b-0000-4000-8000-000000000001', placeId: 'demo-01', type: 'correction', targetField: 'hours', voteChoice: null, body: '時間が違いました', visitedOn: null };
    await expect(b.reports.submit(input)).rejects.toMatchObject({ kind: 'auth_required' });
    await b.auth.sendOtp('a@example.com');
    await expect(b.auth.verifyOtp('a@example.com', DEMO_EXPIRED_CODE)).rejects.toMatchObject({ kind: 'otp_invalid_or_expired' });
    await b.auth.verifyOtp('a@example.com', DEMO_OTP_CODE);
    expect((await b.auth.getState()).simulated).toBe(true);
    const r1 = await b.reports.submit(input);
    const r2 = await b.reports.submit(input);
    expect(r1).toEqual({ id: r2.id, storedAt: 'demo_local' });
    await b.auth.signOut();
    expect((await b.auth.getState()).signedIn).toBe(false);
  });
});

describe('端末保存', () => {
  test('保存と犬プロフィールは再起動（新しいインスタンス）後も残る', async () => {
    const kv = new MemoryKV();
    const place = makePlace({ id: 'p-save' });
    await new SavedPlacesStore(new LocalStore('production', kv)).save(place, NOW);
    await new DogProfileStore(new LocalStore('production', kv)).save({ ...EMPTY_DOG_PROFILE, name: 'ポチ', weightKg: 4.5, carryMethods: ['bag'], canBringCertificate: 'yes' });
    // 再起動を想定：別インスタンスで読み直す
    const saved = await new SavedPlacesStore(new LocalStore('production', kv)).list();
    expect(saved.map((s) => s.placeId)).toEqual(['p-save']);
    expect(saved[0].snapshot.name).toBe('テスト施設');
    expect(await new DogProfileStore(new LocalStore('production', kv)).load()).toEqual({ ...EMPTY_DOG_PROFILE, name: 'ポチ', weightKg: 4.5, carryMethods: ['bag'], canBringCertificate: 'yes' });
  });

  test('デモと本番で保存領域を分ける', async () => {
    const kv = new MemoryKV();
    await new SavedPlacesStore(new LocalStore('demo', kv)).save(makePlace({ id: 'demo-x' }), NOW);
    expect(await new SavedPlacesStore(new LocalStore('production', kv)).list()).toEqual([]);
  });

  test('壊れた・未知のプロフィール値は不明に戻す', async () => {
    const kv = new MemoryKV();
    await kv.setItem('inu-to-suzumeru:demo:dog-profile', JSON.stringify({ weightKg: -3, carryMethods: ['fly', 'cart'], canBringCertificate: 'maybe' }));
    expect(await new DogProfileStore(new LocalStore('demo', kv)).load()).toEqual({ ...EMPTY_DOG_PROFILE, carryMethods: ['cart'] });
  });

  const repoWith = (impl: PlaceRepository['getPlacesByIds']): PlaceRepository =>
    ({ mode: 'production', getPlacesByIds: impl }) as unknown as PlaceRepository;

  test('再取得が成功し対象が見つからない → unavailable（通信エラーと区別）', async () => {
    const s = new SavedPlacesStore(new LocalStore('production', new MemoryKV()));
    await s.save(makePlace({ id: 'gone' }), NOW);
    await s.save(makePlace({ id: 'alive' }), NOW);
    const r = await s.refresh(repoWith(async () => ({ found: [makePlace({ id: 'alive', extra: { name: '新しい名前' } })], missingIds: ['gone'] })), new Date(NOW.getTime() + 1000));
    expect(r.error).toBeNull();
    expect(Object.fromEntries(r.statuses.map((x) => [x.place.id, x.kind]))).toEqual({ gone: 'unavailable', alive: 'fresh' });
    expect(r.statuses.find((x) => x.place.id === 'alive')!.place.name).toBe('新しい名前');
  });

  test('通信エラー → キャッシュと取得日時を返す（unavailable にしない）', async () => {
    const s = new SavedPlacesStore(new LocalStore('production', new MemoryKV()));
    await s.save(makePlace({ id: 'p' }), NOW);
    const r = await s.refresh(repoWith(async () => {
      throw new RepoError('network');
    }));
    expect(r.error?.kind).toBe('network');
    expect(r.statuses).toEqual([{ kind: 'cached', place: expect.objectContaining({ id: 'p' }), fetchedAt: NOW.toISOString() }]);
  });
});

describe('DB 行 → ドメイン（unknown を失わない）', () => {
  test('null や想定外の値は unknown', () => {
    const z = mapZone({
      id: 'z', place_id: 'p', name: '店内', scope: 'indoor_whole',
      indoor_dogs: null as never, air_conditioning: 'maybe' as never,
      weight_limit_kind: 'max_kg', weight_max_kg: null, weight_max_inclusive: null, weight_limit_text: null,
      carry_status: 'confirmed', carry_methods: [], carry_text: null,
      certificate: null as never, certificate_text: null, extra_requirements: [{ text: '大型犬はカート' }],
    });
    expect(z.indoorDogs).toBe('unknown');
    expect(z.airConditioning).toBe('unknown');
    expect(z.weightLimit).toEqual({ kind: 'unknown' });
    expect(z.carry.status).toBe('unknown'); // 確認済みでも方法が空なら不明
    expect(z.certificate).toEqual({ status: 'unknown' });
    expect(z.extraRequirements).toEqual([{ text: '大型犬はカート', effect: 'needs_check' }]);
  });

  test('区画がない施設・権利情報のない写真', () => {
    const row = {
      id: 'x', name: 'n', category: 'cafe', address: 'a', area_id: 'minato', lat: 35.6, lng: 139.7, timezone: 'Asia/Tokyo',
      publication_status: 'published', operating_status: 'normal', eligibility: 'open', eligibility_text: null,
      order_required: 'no', order_text: null, reservation_required: 'no', reservation_text: null, fee_status: 'free', fee_text: null,
      water: 'yes', business_hours_status: 'unknown', dog_hours_mode: 'unknown', phone: null, official_url: null,
      photo_url: 'https://example.com/a.jpg', photo_rights: null, photo_credit: null, description: null,
      reservation_url: 'http://example.com/insecure', atmosphere_tags: null,
      created_at: '', updated_at: '', place_dog_zones: [], place_hours: null, place_hour_exceptions: null, place_verifications: null,
    } as PlaceRow;
    const p = mapPlace(row);
    expect(p.zone.indoorDogs).toBe('unknown');
    expect(p.media).toEqual([]);
    expect(p.reservationUrl).toBeUndefined(); // https 以外の予約URLは使わない
    expect(p.atmosphereTags).toEqual([]);
    expect(p.businessHours.weekly.status).toBe('unknown');
    expect(p.isDemo).toBe(false);
  });
});
