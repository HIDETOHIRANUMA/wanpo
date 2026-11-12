import type { SupabaseClient } from '@supabase/supabase-js';
import { base64ToArrayBuffer } from '../base64';
import { createDemoBackend, DEMO_OTP_CODE } from '../demo/DemoBackend';
import { mapMedia, mapReview } from '../supabase/mappers';
import { SupabaseRepository, SupabaseUgc } from '../supabase/SupabaseBackend';
import { boundingBox, distanceKm } from '@/domain/geo';
import { validateReview, type ReviewInput } from '@/domain/ugc';
import { LastOriginStore } from '@/storage/lastOrigin';
import { LocalStore, MemoryKV } from '@/storage/localStore';
import { contactActions } from '@/ui/contactPolicy';
import { makePlace } from '@/domain/__tests__/fixtures';

jest.mock('react-native', () => ({ Platform: { OS: 'ios' }, AppState: { addEventListener: jest.fn() } }));

const review = (o: Partial<ReviewInput> = {}): ReviewInput => ({
  requestId: 'r1',
  placeId: 'demo-01',
  nickname: 'ぽち',
  body: '涼しかったです',
  tags: ['cool_inside'],
  visitedOn: null,
  ...o,
});

describe('口コミの入力チェック', () => {
  test('正しい入力', () => expect(validateReview(review(), '2026-07-15')).toEqual([]));
  test('ニックネーム・本文は空白だけでは不可、文字数上限あり', () => {
    expect(validateReview(review({ nickname: '  ' }), '2026-07-15')).toContain('nickname');
    expect(validateReview(review({ nickname: 'あ'.repeat(21) }), '2026-07-15')).toContain('nickname');
    expect(validateReview(review({ body: '　 ' }), '2026-07-15')).toEqual(['body']);
    expect(validateReview(review({ body: 'あ'.repeat(1001) }), '2026-07-15')).toEqual(['body']);
  });
  test('訪問日は今日以前・2年以内', () => {
    expect(validateReview(review({ visitedOn: '2026-07-16' }), '2026-07-15')).toEqual(['visitedOn']);
    expect(validateReview(review({ visitedOn: '2024-07-01' }), '2026-07-15')).toEqual(['visitedOn']);
    expect(validateReview(review({ visitedOn: '2026-07-15' }), '2026-07-15')).toEqual([]);
  });
  test('決められたタグだけ', () => {
    expect(validateReview(review({ tags: ['cool_inside', 'bad' as never] }), '2026-07-15')).toEqual(['tags']);
  });
});

describe('デモの口コミ・写真（端末内のみ）', () => {
  const setup = async (signIn = true) => {
    const b = createDemoBackend(new LocalStore('demo', new MemoryKV()));
    if (signIn) await b.auth.verifyOtp('a@example.com', DEMO_OTP_CODE);
    return b;
  };
  test('ログインしないと投稿できない', async () => {
    const b = await setup(false);
    await expect(b.ugc.submitReview(review())).rejects.toMatchObject({ kind: 'auth_required' });
  });
  test('投稿すると自分の口コミとして表示・件数に反映。同じ受付IDの再送は重複しない', async () => {
    const b = await setup();
    const before = (await b.places.getUgcCounts(['demo-01']))['demo-01']?.reviewCount ?? 0;
    const r1 = await b.ugc.submitReview(review());
    const r2 = await b.ugc.submitReview(review({ body: '再送' }));
    expect(r1).toEqual(r2);
    expect(r1.storedAt).toBe('demo_local');
    const list = await b.ugc.listReviews('demo-01');
    expect(list.filter((r) => r.mine)).toHaveLength(1);
    expect((await b.places.getUgcCounts(['demo-01']))['demo-01'].reviewCount).toBe(before + 1);
  });
  test('1日5件まで', async () => {
    const b = await setup();
    for (let i = 0; i < 5; i++) await b.ugc.submitReview(review({ requestId: `r${i}` }));
    await expect(b.ugc.submitReview(review({ requestId: 'r9' }))).rejects.toMatchObject({ kind: 'rate_limited' });
  });
  test('通報した口コミはこの端末で非表示。自分の口コミは削除できる', async () => {
    const b = await setup();
    const seeded = (await b.ugc.listReviews('demo-01')).find((r) => !r.mine)!;
    await b.ugc.flag('review', seeded.id, 'spam');
    expect((await b.ugc.listReviews('demo-01')).some((r) => r.id === seeded.id)).toBe(false);
    const mine = await b.ugc.submitReview(review());
    await b.ugc.deleteReview(mine.id);
    expect((await b.ugc.listReviews('demo-01')).some((r) => r.mine)).toBe(false);
  });
  test('写真は端末内の画像として保存（送信しない）', async () => {
    const b = await setup();
    const r = await b.ugc.submitPhoto({ requestId: 'p1', placeId: 'demo-01', caption: 'ひと休み', image: { uri: 'x', width: 10, height: 10, dataUri: 'data:image/jpeg;base64,AAAA' } });
    expect(r.storedAt).toBe('demo_local');
    const photos = await b.ugc.listPhotos('demo-01');
    expect(photos).toHaveLength(1);
    expect(photos[0].url.startsWith('data:image/jpeg')).toBe(true);
  });
  test('アカウント削除（デモ）で投稿も消える', async () => {
    const b = await setup();
    await b.ugc.submitReview(review());
    await b.auth.deleteAccount();
    await b.auth.verifyOtp('a@example.com', DEMO_OTP_CODE);
    expect((await b.ugc.listReviews('demo-01')).some((r) => r.mine)).toBe(false);
  });
});

describe('全国の検索範囲', () => {
  test('範囲の四角は半径の円を含む', () => {
    for (const c of [{ lat: 35.68, lng: 139.76 }, { lat: 43.06, lng: 141.35 }, { lat: 26.21, lng: 127.68 }]) {
      const b = boundingBox(c, 10);
      for (const pt of [{ lat: b.maxLat, lng: c.lng }, { lat: c.lat, lng: b.maxLng }, { lat: b.minLat, lng: c.lng }, { lat: c.lat, lng: b.minLng }])
        expect(distanceKm(c, pt)).toBeGreaterThanOrEqual(9.9);
    }
  });
  test('デモ：札幌を基準にすると札幌の施設だけ取得', async () => {
    const b = createDemoBackend(new LocalStore('demo', new MemoryKV()));
    const list = await b.places.listPlacesNear({ lat: 43.0607, lng: 141.3545 }, 10);
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((p) => p.areaId === 'sapporo-chuo')).toBe(true);
    expect((await b.places.searchStations('天神'))[0].name).toBe('天神駅');
    expect((await b.places.listAreas(27)).map((a) => a.id)).toEqual(['osaka-kita']);
  });
  test('本番：緯度経度の範囲で絞り込んで取得する', async () => {
    const calls: [string, string, number][] = [];
    const chain: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'in', 'limit', 'order']) chain[m] = () => chain;
    for (const m of ['gte', 'lte']) chain[m] = (col: string, v: number) => (calls.push([m, col, v]), chain);
    chain.then = (res: (v: unknown) => void) => res({ data: [], error: null });
    await new SupabaseRepository({ from: () => chain } as unknown as SupabaseClient).listPlacesNear({ lat: 35, lng: 135 }, 5);
    expect(calls.filter((c) => c[1] === 'lat' || c[1] === 'lng')).toHaveLength(4);
  });
  test('本番：駅名検索はパターン文字を取り除く', async () => {
    let pattern = '';
    const chain: Record<string, unknown> = {};
    for (const m of ['select', 'order', 'limit']) chain[m] = () => chain;
    chain.ilike = (_c: string, p: string) => ((pattern = p), chain);
    chain.then = (res: (v: unknown) => void) => res({ data: [], error: null });
    await new SupabaseRepository({ from: () => chain } as unknown as SupabaseClient).searchStations('梅田%_,()駅');
    expect(pattern).toBe('%梅田%');
  });
  test('前回の基準点：現在地は保存しない', async () => {
    const s = new LastOriginStore(new LocalStore('demo', new MemoryKV()));
    await s.save({ kind: 'current_location', label: '現在地', lat: 35, lng: 139 });
    expect(await s.load()).toBeNull();
    await s.save({ kind: 'station', label: '梅田駅', lat: 34.7, lng: 135.5 });
    expect((await s.load())?.label).toBe('梅田駅');
  });
});

describe('写真の投稿（本番）', () => {
  const image = { uri: 'file://x.jpg', width: 10, height: 10, base64: 'QUJD' };
  const make = (uploadResult: unknown) => {
    const rpc = jest.fn(async (name: string) => {
      if (name === 'begin_photo_upload') return { data: [{ photo_id: 'ph1', storage_path: 'uid/ph1.jpg' }], error: null };
      if (name === 'complete_photo_upload') return { data: 'approved', error: null };
      return { data: null, error: null };
    });
    const upload = jest.fn(async () => uploadResult);
    const client = { rpc, storage: { from: () => ({ upload }) } } as unknown as SupabaseClient;
    return { ugc: new SupabaseUgc(client), rpc, upload };
  };
  test('枠の確保 → 本人フォルダへアップロード → 完了 の順', async () => {
    const { ugc, rpc, upload } = make({ data: {}, error: null });
    const r = await ugc.submitPhoto({ requestId: 'q', placeId: 'p', caption: '', image });
    expect(r).toEqual({ id: 'ph1', status: 'approved', storedAt: 'server' });
    expect(upload).toHaveBeenCalledWith('uid/ph1.jpg', expect.any(ArrayBuffer), { contentType: 'image/jpeg', upsert: false });
    expect(rpc.mock.calls.map((c) => c[0])).toEqual(['begin_photo_upload', 'complete_photo_upload']);
  });
  test('再送で「既にある」と返ったら成功として完了へ進む', async () => {
    const { ugc, rpc } = make({ data: null, error: { statusCode: '409', message: 'The resource already exists' } });
    await ugc.submitPhoto({ requestId: 'q', placeId: 'p', caption: '', image });
    expect(rpc.mock.calls.map((c) => c[0])).toContain('complete_photo_upload');
  });
  test('アップロードの通信失敗は投稿済みにしない', async () => {
    const { ugc, rpc, upload } = make(null);
    upload.mockRejectedValueOnce(new TypeError('Network request failed'));
    await expect(ugc.submitPhoto({ requestId: 'q', placeId: 'p', caption: '', image })).rejects.toMatchObject({ kind: 'network' });
    expect(rpc.mock.calls.map((c) => c[0])).not.toContain('complete_photo_upload');
  });
});

describe('写真・口コミの表示用データ', () => {
  test('権利・出典のない写真、https 以外の写真は表示しない。旧来の写真を先頭に', () => {
    const m = mapMedia({
      photo_url: 'https://example.com/main.jpg',
      photo_rights: '店舗提供',
      photo_credit: '店',
      place_media: [
        { id: 'b', url: 'https://example.com/b.jpg', kind: 'interior', caption: null, rights: '許諾', credit: '店', sort: 2 },
        { id: 'a', url: 'https://example.com/a.jpg', kind: 'dog_area', caption: '犬席', rights: '許諾', credit: '店', sort: 1 },
        { id: 'c', url: 'http://example.com/c.jpg', kind: 'interior', caption: null, rights: '許諾', credit: '店', sort: 0 },
        { id: 'd', url: 'https://example.com/d.jpg', kind: 'interior', caption: null, rights: null, credit: '店', sort: 0 },
      ],
    });
    expect(m.map((x) => x.id)).toEqual(['main', 'a', 'b']);
  });
  test('未知のタグは捨てる。状態が取れない公開一覧は公開中として扱う', () => {
    const r = mapReview({ id: '1', place_id: 'p', nickname: 'n', body: 'b', tags: ['quiet', 'evil'], visited_on: null, published_at: 'x' }, false);
    expect(r.tags).toEqual(['quiet']);
    expect(r.status).toBe('approved');
  });
  test('予約ページ：本番の https だけ有効、デモは無効', () => {
    const p = makePlace({ extra: { reservationUrl: 'https://example.com/r', isDemo: false } });
    expect(contactActions(p, { isDemoMode: false, source: 'live', platform: 'ios' }).reservationUrl).toBe('https://example.com/r');
    expect(contactActions(p, { isDemoMode: true, source: 'live', platform: 'ios' }).reservationUrl).toBeNull();
    expect(contactActions(p, { isDemoMode: false, source: 'unavailable', platform: 'ios' }).reservationUrl).toBeNull();
  });
  test('base64 を元のバイト列に戻す', () => {
    expect(Array.from(new Uint8Array(base64ToArrayBuffer('QUJD')))).toEqual([65, 66, 67]);
    expect(Array.from(new Uint8Array(base64ToArrayBuffer('data:image/jpeg;base64,QUI=')))).toEqual([65, 66]);
    expect(Array.from(new Uint8Array(base64ToArrayBuffer('QQ==')))).toEqual([65]);
  });
});
