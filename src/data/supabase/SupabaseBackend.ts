import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import { previousDate, toJst } from '@/domain/hours';
import { boundingBox, distanceKm, type LatLng } from '@/domain/geo';
import type { HeatPoint } from '@/domain/heat';
import type { Area, Place, Station } from '@/domain/types';
import type { FlagReason, PhotoInput, Review, ReviewInput, UgcCounts, UgcStatus, UgcSubmitResult, UserPhoto } from '@/domain/ugc';
import { base64ToArrayBuffer } from '../base64';
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
  type HeatResult,
  type HeatService,
  type UgcService,
} from '../repository';
import type { AreaRow, PhotoRow, PlaceRow, ReviewRow, StationRow, WbgtPointRow } from './dbTypes';
import { mapDogInfo, mapPlace, mapReview } from './mappers';

export const USER_PHOTO_BUCKET = 'user-photos';
/** 署名URLの有効期限（秒）。期限後は画面の再読み込みで取り直す */
const SIGNED_URL_TTL = 3600;

const PLACE_SELECT =
  'id,name,category,address,area_id,lat,lng,timezone,publication_status,operating_status,' +
  'eligibility,eligibility_text,order_required,order_text,reservation_required,reservation_text,' +
  'fee_status,fee_text,water,business_hours_status,dog_hours_mode,phone,official_url,photo_url,' +
  'photo_rights,photo_credit,description,reservation_url,atmosphere_tags,created_at,updated_at,' +
  'areas(name,prefecture),place_media(id,url,kind,caption,rights,credit,sort),' +
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

  async listAreas(prefectureCode?: number): Promise<Area[]> {
    let q = this.client.from('areas').select('id,name,prefecture,prefecture_code,lat,lng');
    if (prefectureCode) q = q.eq('prefecture_code', prefectureCode);
    const rows = await this.run<AreaRow[]>(q.order('municipality_code', { nullsFirst: false }).order('id').limit(400));
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      prefecture: r.prefecture,
      prefectureCode: r.prefecture_code ?? undefined,
      lat: r.lat,
      lng: r.lng,
    }));
  }

  async searchStations(query: string): Promise<Station[]> {
    // PostgREST のパターン文字・区切り文字は取り除く
    const q = query.replace(/[%_\\,()*]/g, '').replace(/駅$/, '').trim().slice(0, 20);
    if (!q) return [];
    const rows = await this.run<StationRow[]>(
      this.client.from('stations').select('id,name,area_id,line_name,operator,lat,lng').ilike('name', `%${q}%`).order('name').limit(30),
    );
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      areaId: r.area_id,
      lineName: r.line_name ?? undefined,
      operator: r.operator ?? undefined,
      lat: r.lat,
      lng: r.lng,
    }));
  }

  async listPlacesNear(center: LatLng, radiusKm: number): Promise<Place[]> {
    const b = boundingBox(center, radiusKm);
    const rows = await this.run<PlaceRow[]>(
      this.client
        .from('places')
        .select(PLACE_SELECT)
        .eq('publication_status', 'published')
        .gte('lat', b.minLat)
        .lte('lat', b.maxLat)
        .gte('lng', b.minLng)
        .lte('lng', b.maxLng)
        .gte('place_hour_exceptions.date', this.exceptionFrom())
        .limit(500) as unknown as PromiseLike<{ data: PlaceRow[] | null; error: unknown }>,
    );
    return rows.map(mapPlace);
  }

  async getUgcCounts(placeIds: string[]): Promise<Record<string, UgcCounts>> {
    const ids = placeIds.filter((id) => /^[0-9a-f-]{36}$/i.test(id)).slice(0, 200);
    if (ids.length === 0) return {};
    const rows = await this.run<{ place_id: string; review_count: number; photo_count: number }[]>(
      this.client.rpc('place_ugc_counts', { p_place_ids: ids }) as unknown as PromiseLike<{ data: never; error: unknown }>,
    );
    return Object.fromEntries(rows.map((r) => [r.place_id, { reviewCount: r.review_count, photoCount: r.photo_count }]));
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

const REVIEW_PUBLIC_COLS_V1 = 'id,place_id,nickname,body,tags,visited_on,published_at';
const PHOTO_PUBLIC_COLS_V1 = 'id,place_id,storage_path,caption,published_at';
// 犬の大きさ・犬種の列（20261114 のマイグレーションで追加）
const REVIEW_PUBLIC_COLS = `${REVIEW_PUBLIC_COLS_V1},dog_size,dog_breed`;
const PHOTO_PUBLIC_COLS = `${PHOTO_PUBLIC_COLS_V1},dog_size,dog_breed`;

/** DB が新しい列・関数をまだ持たない（マイグレーション未適用）ときのエラーか */
function isMissingSchema(e: unknown): boolean {
  return e instanceof RepoError && e.kind === 'server' && (e.devDetail === '42703' || e.devDetail === 'PGRST202' || e.devDetail === 'PGRST204');
}

/** 新しい形で試し、DB が古ければ旧形式でやり直す */
async function withLegacy<T>(next: () => Promise<T>, legacy: () => Promise<T>): Promise<T> {
  try {
    return await next();
  } catch (e) {
    if (isMissingSchema(e)) return legacy();
    throw e;
  }
}

export class SupabaseUgc implements UgcService {
  constructor(private client: SupabaseClient) {}

  private async call<T>(fn: () => PromiseLike<{ data: T | null; error: unknown }>): Promise<T> {
    let res: { data: T | null; error: unknown };
    try {
      res = await fn();
    } catch (e) {
      throw toRepoError(e);
    }
    if (res.error) throw toRepoError(res.error);
    return res.data as T;
  }

  private async signedIn(): Promise<boolean> {
    const { data } = await this.client.auth.getSession();
    return !!data.session;
  }

  /** 自分の投稿ID（投稿者IDの列は公開されないため、専用の関数で照会する） */
  private async myIds(placeId: string): Promise<Set<string>> {
    if (!(await this.signedIn())) return new Set();
    const rows = await this.call<{ target_type: string; id: string }[]>(() => this.client.rpc('my_ugc_ids', { p_place_id: placeId }));
    return new Set(rows.map((r) => r.id));
  }

  async listReviews(placeId: string): Promise<Review[]> {
    const signedIn = await this.signedIn();
    const query = (cols: string) =>
      this.call<ReviewRow[]>(() =>
        this.client
          .from('place_reviews')
          .select(signedIn ? `${cols},status` : cols)
          .eq('place_id', placeId)
          .order('published_at', { ascending: false, nullsFirst: true })
          .limit(50) as unknown as PromiseLike<{ data: ReviewRow[] | null; error: unknown }>,
      );
    const [rows, mine] = await Promise.all([
      withLegacy(() => query(REVIEW_PUBLIC_COLS), () => query(REVIEW_PUBLIC_COLS_V1)),
      this.myIds(placeId),
    ]);
    return rows.map((r) => mapReview(r, mine.has(r.id)));
  }

  async listPhotos(placeId: string): Promise<UserPhoto[]> {
    const signedIn = await this.signedIn();
    const query = (cols: string) =>
      this.call<PhotoRow[]>(() =>
        this.client
          .from('place_photos')
          .select(signedIn ? `${cols},status,uploaded` : cols)
          .eq('place_id', placeId)
          .order('published_at', { ascending: false, nullsFirst: true })
          .limit(60) as unknown as PromiseLike<{ data: (PhotoRow & { uploaded?: boolean })[] | null; error: unknown }>,
      );
    const [rows, mine] = await Promise.all([
      withLegacy(() => query(PHOTO_PUBLIC_COLS), () => query(PHOTO_PUBLIC_COLS_V1)),
      this.myIds(placeId),
    ]);
    const visible = (rows as (PhotoRow & { uploaded?: boolean })[]).filter((r) => r.uploaded !== false);
    if (visible.length === 0) return [];
    // 非公開バケットなので期限つきの署名URLで表示する（Storage の権限で公開中か本人の写真だけ発行される）
    const signed = await this.call<{ path: string | null; signedUrl: string; error: string | null }[]>(() =>
      this.client.storage.from(USER_PHOTO_BUCKET).createSignedUrls(
        visible.map((r) => r.storage_path),
        SIGNED_URL_TTL,
      ) as unknown as PromiseLike<{ data: never; error: unknown }>,
    );
    const urlByPath = new Map(signed.filter((x) => !x.error && x.signedUrl && x.path).map((x) => [x.path as string, x.signedUrl]));
    return visible
      .filter((r) => urlByPath.has(r.storage_path))
      .map((r) => ({
        id: r.id,
        placeId: r.place_id,
        url: urlByPath.get(r.storage_path)!,
        caption: r.caption,
        publishedAt: r.published_at,
        mine: mine.has(r.id),
        status: (r.status ?? 'approved') as UgcStatus,
        storagePath: r.storage_path,
        ...mapDogInfo(r),
      }));
  }

  private async ownStatus(table: 'place_reviews' | 'place_photos', id: string): Promise<UgcStatus> {
    const rows = await this.call<{ status: UgcStatus }[]>(
      () => this.client.from(table).select('status').eq('id', id).limit(1) as unknown as PromiseLike<{ data: never; error: unknown }>,
    );
    return rows[0]?.status ?? 'pending';
  }

  async submitReview(i: ReviewInput): Promise<UgcSubmitResult> {
    const base = {
      p_request_id: i.requestId,
      p_place_id: i.placeId,
      p_nickname: i.nickname,
      p_body: i.body,
      p_tags: i.tags,
      p_visited_on: i.visitedOn,
    };
    const id = await withLegacy(
      () => this.call<string>(() => this.client.rpc('submit_place_review_v2', { ...base, p_dog_size: i.dogSize, p_dog_breed: i.dogBreed })),
      () => this.call<string>(() => this.client.rpc('submit_place_review', base)),
    );
    if (typeof id !== 'string') throw new RepoError('server', 'no id');
    // 状態の取得に失敗しても投稿自体は受付済み
    const status = await this.ownStatus('place_reviews', id).catch(() => 'pending' as UgcStatus);
    return { id, status, storedAt: 'server' };
  }

  async submitPhoto(i: PhotoInput): Promise<UgcSubmitResult> {
    if (!i.image.base64) throw new RepoError('validation', 'image');
    // 1) 投稿枠を確保（回数制限・公開施設かの確認はサーバー側）
    const base = { p_request_id: i.requestId, p_place_id: i.placeId, p_caption: i.caption };
    const slot = await withLegacy(
      () =>
        this.call<{ photo_id: string; storage_path: string }[]>(() =>
          this.client.rpc('begin_photo_upload_v2', { ...base, p_dog_size: i.dogSize, p_dog_breed: i.dogBreed }),
        ),
      () => this.call<{ photo_id: string; storage_path: string }[]>(() => this.client.rpc('begin_photo_upload', base)),
    );
    const s = slot[0];
    if (!s) throw new RepoError('server', 'no slot');
    // 2) Storage の本人フォルダへアップロード（同じ枠への再送は「既にある」を成功とみなす）
    const body = base64ToArrayBuffer(i.image.base64);
    let up: { error: { message?: string; statusCode?: string } | null };
    try {
      up = (await this.client.storage
        .from(USER_PHOTO_BUCKET)
        .upload(s.storage_path, body, { contentType: 'image/jpeg', upsert: false })) as typeof up;
    } catch (e) {
      throw toRepoError(e);
    }
    if (up.error && !(up.error.statusCode === '409' || /already exists|Duplicate/i.test(up.error.message ?? ''))) {
      throw toRepoError(up.error);
    }
    // 3) 完了（ファイルの存在をサーバーが確認してから公開状態にする）
    const status = await this.call<UgcStatus>(() => this.client.rpc('complete_photo_upload', { p_photo_id: s.photo_id }));
    return { id: s.photo_id, status, storedAt: 'server' };
  }

  async deleteReview(id: string): Promise<void> {
    await this.call<boolean>(() => this.client.rpc('delete_my_review', { p_id: id }));
  }

  async deletePhoto(photo: UserPhoto): Promise<void> {
    // ファイルを先に消し、成功したら記録を消す（記録だけ残った場合は再試行で消せる）
    await this.call<unknown>(
      () => this.client.storage.from(USER_PHOTO_BUCKET).remove([photo.storagePath]) as unknown as PromiseLike<{ data: unknown; error: unknown }>,
    );
    await this.call<boolean>(() => this.client.rpc('delete_my_photo', { p_id: photo.id }));
  }

  async flag(target: 'review' | 'photo', id: string, reason: FlagReason): Promise<void> {
    await this.call<unknown>(() => this.client.rpc('flag_ugc', { p_target_type: target, p_target_id: id, p_reason: reason }));
  }

  async blockAuthor(target: 'review' | 'photo', id: string): Promise<void> {
    await this.call<unknown>(() => this.client.rpc('block_ugc_author', { p_target_type: target, p_target_id: id }));
  }

  async unblockAll(): Promise<number> {
    const n = await this.call<number>(() => this.client.rpc('unblock_all_ugc_authors'));
    return typeof n === 'number' ? n : 0;
  }
}

/** 観測地点がこれより遠ければ「その地域の暑さ指数はない」とする */
const MAX_POINT_DISTANCE_KM = 40;

/**
 * 暑さ指数：観測地点の一覧（公開テーブル）を読み、端末で最寄りを選んでから
 * 地点番号だけを Edge Function に渡す（利用者の位置はサーバーへ送らない）。
 */
export class SupabaseHeat implements HeatService {
  private points: WbgtPointRow[] | null = null;
  constructor(private client: SupabaseClient) {}

  private async loadPoints(): Promise<WbgtPointRow[]> {
    if (this.points) return this.points;
    const res = await this.client.from('wbgt_points').select('id,name,lat,lng').limit(2000);
    if (res.error) {
      const e = toRepoError(res.error);
      // テーブル未作成（マイグレーション未適用）は「未設定」として扱う
      if (e.devDetail === '42P01' || e.devDetail === 'PGRST205') return [];
      throw e;
    }
    this.points = (res.data ?? []) as WbgtPointRow[];
    return this.points;
  }

  async forecast(at: LatLng): Promise<HeatResult> {
    const points = await this.loadPoints();
    if (points.length === 0) return { status: 'unavailable', reason: 'not_configured' };
    let best: { p: WbgtPointRow; km: number } | null = null;
    for (const p of points) {
      const km = distanceKm(at, p);
      if (!best || km < best.km) best = { p, km };
    }
    if (!best || best.km > MAX_POINT_DISTANCE_KM) return { status: 'unavailable', reason: 'no_point' };
    let data: { status?: string; reason?: string; issued_at?: string | null; hourly?: HeatPoint[] } | null;
    try {
      const res = await this.client.functions.invoke('heat-index', { body: { point_id: best.p.id } });
      if (res.error) throw res.error;
      data = res.data as typeof data;
    } catch (e) {
      throw toRepoError(e);
    }
    if (!data || data.status !== 'ok' || !Array.isArray(data.hourly) || data.hourly.length === 0) {
      return { status: 'unavailable', reason: data?.reason === 'off_season' ? 'off_season' : 'not_configured' };
    }
    const hourly = data.hourly
      .filter((h) => typeof h?.at === 'string' && typeof h?.wbgt === 'number' && h.wbgt >= 0 && h.wbgt <= 45)
      .sort((a, b) => a.at.localeCompare(b.at));
    if (hourly.length === 0) return { status: 'unavailable', reason: 'off_season' };
    return {
      status: 'ok',
      forecast: {
        source: 'env_go_jp',
        pointId: best.p.id,
        pointName: best.p.name,
        pointDistanceKm: best.km,
        issuedAt: data.issued_at ?? null,
        hourly,
      },
    };
  }
}

export function createSupabaseBackend(url: string, key: string): Backend {
  const client = createSupabaseClient(url, key);
  return {
    mode: 'production',
    places: new SupabaseRepository(client),
    auth: new SupabaseAuth(client),
    reports: new SupabaseReports(client),
    ugc: new SupabaseUgc(client),
    heat: new SupabaseHeat(client),
  };
}

export { toRepoError };
