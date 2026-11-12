import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import { previousDate, toJst } from '@/domain/hours';
import type { Area, Place, Station } from '@/domain/types';
import {
  maskEmail,
  RepoError,
  type AuthService,
  type AuthState,
  type Backend,
  type PlaceRepository,
  type PlacesByIdsResult,
  type ReportInput,
  type ReportResult,
  type ReportService,
} from '../repository';
import type { AreaRow, PlaceRow, StationRow } from './dbTypes';
import { mapPlace } from './mappers';

const PLACE_SELECT =
  'id,name,category,address,area_id,lat,lng,timezone,publication_status,operating_status,' +
  'eligibility,eligibility_text,order_required,order_text,reservation_required,reservation_text,' +
  'fee_status,fee_text,water,business_hours_status,dog_hours_mode,phone,official_url,photo_url,' +
  'photo_rights,photo_credit,description,created_at,updated_at,' +
  'place_dog_zones(*),place_hours(schedule,weekday,open_minute,close_minute),' +
  'place_hour_exceptions(schedule,date,is_closed,open_minute,close_minute,note),' +
  'place_verifications(id,field,method,verified_at,evidence_url,evidence_note)';

/** 通信失敗とサーバーエラーを区別する。ログにトークン・メール・位置を残さない */
function toRepoError(e: unknown): RepoError {
  if (e instanceof RepoError) return e;
  const err = e as { message?: string; code?: string; status?: number; name?: string } | null;
  const msg = err?.message ?? '';
  if (/Network request failed|Failed to fetch|fetch failed|network/i.test(msg) || err?.name === 'AuthRetryableFetchError')
    return new RepoError('network');
  if (/rate_limited/.test(msg)) return new RepoError('rate_limited');
  if (/auth_required/.test(msg) || err?.code === '28000' || err?.status === 401) return new RepoError('auth_required');
  if (/^validation/.test(msg) || err?.code === '22023') return new RepoError('validation', msg.slice(0, 60));
  return new RepoError('server', err?.code ?? err?.name ?? 'unknown');
}

export function createSupabaseClient(url: string, publishableKey: string): SupabaseClient {
  const client = createClient(url, publishableKey, {
    auth: {
      // セッションは端末内に保存し、ログアウトで破棄する（signOut がストレージから削除）
      ...(Platform.OS !== 'web' ? { storage: AsyncStorage } : {}),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
  if (Platform.OS !== 'web') {
    // 公式手順：前面にある間だけトークンを自動更新
    AppState.addEventListener('change', (state) => {
      if (state === 'active') client.auth.startAutoRefresh();
      else client.auth.stopAutoRefresh();
    });
  }
  return client;
}

export class SupabaseRepository implements PlaceRepository {
  readonly mode = 'production' as const;
  constructor(private client: SupabaseClient) {}

  private async run<T>(q: PromiseLike<{ data: T | null; error: unknown }>): Promise<T> {
    let res: { data: T | null; error: unknown };
    try {
      res = await q;
    } catch (e) {
      throw toRepoError(e);
    }
    if (res.error) throw toRepoError(res.error);
    return res.data as T;
  }

  /** 昨日以降の日付別変更だけ取得（日またぎ判定に前日分が必要） */
  private exceptionFrom(): string {
    return previousDate(toJst(new Date()).date);
  }

  async listAreas(): Promise<Area[]> {
    const rows = await this.run<AreaRow[]>(this.client.from('areas').select('id,name,prefecture,lat,lng').order('id'));
    return rows.map((r) => ({ id: r.id, name: r.name, prefecture: r.prefecture, lat: r.lat, lng: r.lng }));
  }

  async listStations(): Promise<Station[]> {
    const rows = await this.run<StationRow[]>(this.client.from('stations').select('id,name,area_id,lat,lng').order('name'));
    return rows.map((r) => ({ id: r.id, name: r.name, areaId: r.area_id, lat: r.lat, lng: r.lng }));
  }

  async listPublishedPlaces(): Promise<Place[]> {
    const rows = await this.run<PlaceRow[]>(
      this.client
        .from('places')
        .select(PLACE_SELECT)
        .eq('publication_status', 'published')
        .gte('place_hour_exceptions.date', this.exceptionFrom())
        .limit(1000) as unknown as PromiseLike<{ data: PlaceRow[] | null; error: unknown }>,
    );
    return rows.map(mapPlace);
  }

  async getPlace(id: string): Promise<Place | null> {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    const rows = await this.run<PlaceRow[]>(
      this.client
        .from('places')
        .select(PLACE_SELECT)
        .eq('id', id)
        .eq('publication_status', 'published')
        .gte('place_hour_exceptions.date', this.exceptionFrom()) as unknown as PromiseLike<{ data: PlaceRow[] | null; error: unknown }>,
    );
    return rows[0] ? mapPlace(rows[0]) : null;
  }

  async getPlacesByIds(ids: string[]): Promise<PlacesByIdsResult> {
    const valid = ids.filter((id) => /^[0-9a-f-]{36}$/i.test(id));
    if (valid.length === 0) return { found: [], missingIds: ids };
    // 公開範囲（RLS）のまま取得する。非公開情報を得るために権限を広げない
    const rows = await this.run<PlaceRow[]>(
      this.client
        .from('places')
        .select(PLACE_SELECT)
        .in('id', valid)
        .eq('publication_status', 'published')
        .gte('place_hour_exceptions.date', this.exceptionFrom()) as unknown as PromiseLike<{ data: PlaceRow[] | null; error: unknown }>,
    );
    const found = rows.map(mapPlace);
    return { found, missingIds: ids.filter((id) => !found.some((p) => p.id === id)) };
  }
}

export class SupabaseAuth implements AuthService {
  constructor(private client: SupabaseClient) {}

  async getState(): Promise<AuthState> {
    const { data } = await this.client.auth.getSession();
    const email = data.session?.user.email ?? null;
    return { signedIn: !!data.session, maskedEmail: maskEmail(email), simulated: false };
  }

  subscribe(cb: (s: AuthState) => void) {
    const { data } = this.client.auth.onAuthStateChange((_event, session) => {
      cb({ signedIn: !!session, maskedEmail: maskEmail(session?.user.email), simulated: false });
    });
    return () => data.subscription.unsubscribe();
  }

  async sendOtp(email: string): Promise<void> {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new RepoError('validation');
    try {
      const { error } = await this.client.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
      if (error) {
        if (error.status === 429 || /rate limit|over_email_send_rate_limit/i.test(`${error.code} ${error.message}`))
          throw new RepoError('otp_send_limited');
        throw toRepoError(error);
      }
    } catch (e) {
      throw toRepoError(e);
    }
  }

  async verifyOtp(email: string, code: string): Promise<void> {
    try {
      const { error } = await this.client.auth.verifyOtp({ email, token: code, type: 'email' });
      if (error) {
        // Supabase は期限切れ・不一致をどちらも otp_expired として返す
        if (error.code === 'otp_expired' || /expired|invalid/i.test(error.message)) throw new RepoError('otp_invalid_or_expired');
        throw toRepoError(error);
      }
    } catch (e) {
      throw toRepoError(e);
    }
  }

  async signOut(): Promise<void> {
    // scope: 'local' でこの端末のセッションを破棄（ストレージからも削除される）
    const { error } = await this.client.auth.signOut({ scope: 'local' });
    if (error) throw toRepoError(error);
  }

  async deleteAccount(): Promise<void> {
    const { data } = await this.client.auth.getSession();
    if (!data.session) throw new RepoError('auth_required');
    try {
      const { error } = await this.client.functions.invoke('delete-account', { method: 'POST', body: {} });
      if (error) {
        const status = (error as { context?: { status?: number } }).context?.status;
        if (status === 401) throw new RepoError('auth_required');
        throw toRepoError(error);
      }
    } catch (e) {
      throw toRepoError(e);
    }
    // サーバー側の削除が成功した後だけ、端末のセッションを破棄する
    await this.client.auth.signOut({ scope: 'local' }).catch(() => undefined);
  }
}

export class SupabaseReports implements ReportService {
  constructor(private client: SupabaseClient) {}
  async submit(i: ReportInput): Promise<ReportResult> {
    let res;
    try {
      res = await this.client.rpc('submit_place_report', {
        p_request_id: i.requestId,
        p_place_id: i.placeId,
        p_report_type: i.type,
        p_target_field: i.targetField,
        p_vote_choice: i.voteChoice,
        p_body: i.body,
        p_visited_on: i.visitedOn,
      });
    } catch (e) {
      throw toRepoError(e);
    }
    if (res.error) throw toRepoError(res.error);
    if (typeof res.data !== 'string') throw new RepoError('server', 'no id');
    return { id: res.data, storedAt: 'server' };
  }
}

export function createSupabaseBackend(url: string, key: string): Backend {
  const client = createSupabaseClient(url, key);
  return {
    mode: 'production',
    places: new SupabaseRepository(client),
    auth: new SupabaseAuth(client),
    reports: new SupabaseReports(client),
  };
}

export { toRepoError };
