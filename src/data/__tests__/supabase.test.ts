import { SupabaseReports, SupabaseRepository, toRepoError } from '../supabase/SupabaseBackend';
import type { SupabaseClient } from '@supabase/supabase-js';

jest.mock('react-native', () => ({ Platform: { OS: 'ios' }, AppState: { addEventListener: jest.fn() } }));

describe('Supabase のエラー分類（通信失敗とサーバー応答を区別）', () => {
  test.each([
    [new TypeError('Network request failed'), 'network'],
    [{ message: 'rate_limited', code: 'P0001' }, 'rate_limited'],
    [{ message: 'auth_required', code: '28000' }, 'auth_required'],
    [{ message: 'validation:place', code: '22023' }, 'validation'],
    [{ message: 'permission denied for table places', code: '42501' }, 'server'],
  ])('%p → %s', (e, kind) => expect(toRepoError(e).kind).toBe(kind));
});

const input = { requestId: '0b0b0b0b-0000-4000-8000-000000000001', placeId: 'p', type: 'correction' as const, targetField: 'hours' as const, voteChoice: null, body: 'x', visitedOn: null };

describe('報告の送信', () => {
  test('サーバーが受付IDを返したときだけ成功', async () => {
    const rpc = jest.fn().mockResolvedValue({ data: 'id-1', error: null });
    const r = await new SupabaseReports({ rpc } as unknown as SupabaseClient).submit(input);
    expect(r).toEqual({ id: 'id-1', storedAt: 'server' });
    expect(rpc).toHaveBeenCalledWith('submit_place_report', expect.objectContaining({ p_request_id: input.requestId }));
  });
  test('通信失敗は送信済みにしない', async () => {
    const rpc = jest.fn().mockRejectedValue(new TypeError('Network request failed'));
    await expect(new SupabaseReports({ rpc } as unknown as SupabaseClient).submit(input)).rejects.toMatchObject({ kind: 'network' });
  });
  test('上限超過はエラー', async () => {
    const rpc = jest.fn().mockResolvedValue({ data: null, error: { message: 'rate_limited', code: 'P0001' } });
    await expect(new SupabaseReports({ rpc } as unknown as SupabaseClient).submit(input)).rejects.toMatchObject({ kind: 'rate_limited' });
  });
});

describe('施設の取得', () => {
  test('通信エラーはエラーとして返し、デモ施設で代用しない', async () => {
    const chain: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'gte', 'lte', 'in', 'limit', 'order']) chain[m] = () => chain;
    chain.then = (_res: unknown, rej: (e: unknown) => void) => rej(new TypeError('Network request failed'));
    const client = { from: () => chain } as unknown as SupabaseClient;
    await expect(new SupabaseRepository(client).listPlacesNear({ lat: 35.6, lng: 139.7 }, 10)).rejects.toMatchObject({ kind: 'network' });
  });
  test('取得成功・0件なら正しく0件', async () => {
    const chain: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'gte', 'lte', 'in', 'limit', 'order']) chain[m] = () => chain;
    chain.then = (res: (v: unknown) => void) => res({ data: [], error: null });
    const client = { from: () => chain } as unknown as SupabaseClient;
    expect(await new SupabaseRepository(client).listPlacesNear({ lat: 35.6, lng: 139.7 }, 10)).toEqual([]);
    const r = await new SupabaseRepository(client).getPlacesByIds(['11111111-1111-1111-1111-111111111111']);
    expect(r).toEqual({ found: [], missingIds: ['11111111-1111-1111-1111-111111111111'] });
  });
});
