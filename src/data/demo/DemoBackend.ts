import { toJst } from '@/domain/hours';
import { boundingBox, type LatLng } from '@/domain/geo';
import type { Area, Place, Station } from '@/domain/types';
import {
  validateReview,
  type FlagReason,
  type PhotoInput,
  type Review,
  type ReviewInput,
  type UgcCounts,
  type UgcSubmitResult,
  type UserPhoto,
} from '@/domain/ugc';
import type { LocalStore } from '@/storage/localStore';
import {
  RepoError,
  type AuthService,
  type AuthState,
  type Backend,
  type PlaceRepository,
  type PlacesByIdsResult,
  type ReportInput,
  type ReportResult,
  type ReportService,
  type UgcService,
} from '../repository';
import { validateReportInput } from '../reportValidation';
import { AREAS, STATIONS } from './areas';
import { createDemoPlaces } from './places';
import { createDemoReviews } from './ugc';

/** デモ：架空データのみ。外部 Auth・メール送信・報告 API は一切呼ばない */
export class DemoRepository implements PlaceRepository {
  readonly mode = 'demo' as const;
  private places: Place[];

  constructor(now: Date = new Date(), private latencyMs = 150) {
    this.places = createDemoPlaces(now);
  }

  private delay() {
    return new Promise((r) => setTimeout(r, this.latencyMs));
  }

  /** 公開済みだけを返す（未公開のデモ施設は一般利用者と同じく見えない） */
  private published() {
    return this.places.filter((p) => p.publicationStatus === 'published');
  }

  async listAreas(prefectureCode?: number): Promise<Area[]> {
    return prefectureCode ? AREAS.filter((a) => a.prefectureCode === prefectureCode) : AREAS;
  }
  async searchStations(query: string): Promise<Station[]> {
    const q = query.replace(/駅$/, '').trim();
    if (!q) return [];
    return STATIONS.filter((s) => s.name.includes(q)).slice(0, 30);
  }
  async listPlacesNear(center: LatLng, radiusKm: number): Promise<Place[]> {
    await this.delay();
    const b = boundingBox(center, radiusKm);
    return this.published().filter((p) => p.lat >= b.minLat && p.lat <= b.maxLat && p.lng >= b.minLng && p.lng <= b.maxLng);
  }
  async getUgcCounts(placeIds: string[]): Promise<Record<string, UgcCounts>> {
    return this.ugc ? this.ugc.counts(placeIds) : {};
  }
  /** 件数の集計に使う（createDemoBackend で接続） */
  ugc?: DemoUgc;
  async getPlace(id: string): Promise<Place | null> {
    await this.delay();
    return this.published().find((p) => p.id === id) ?? null;
  }
  async getPlacesByIds(ids: string[]): Promise<PlacesByIdsResult> {
    await this.delay();
    const found = this.published().filter((p) => ids.includes(p.id));
    return { found, missingIds: ids.filter((id) => !found.some((p) => p.id === id)) };
  }
}

/** デモ用の模擬ログイン。実際の認証・メール送信はしない */
export const DEMO_OTP_CODE = '123456';
/** 期限切れの表示を確認するためのコード */
export const DEMO_EXPIRED_CODE = '000000';

export class DemoAuth implements AuthService {
  private listeners = new Set<(s: AuthState) => void>();
  constructor(private store: LocalStore) {}

  async getState(): Promise<AuthState> {
    const s = await this.store.getJson<{ signedIn: boolean }>('demo-auth');
    return { signedIn: !!s?.signedIn, maskedEmail: s?.signedIn ? 'デモの模擬ログイン' : null, simulated: true };
  }
  subscribe(cb: (s: AuthState) => void) {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }
  private async emit() {
    const s = await this.getState();
    this.listeners.forEach((l) => l(s));
  }
  async sendOtp(email: string): Promise<void> {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new RepoError('validation');
    // 送信しない
  }
  async verifyOtp(_email: string, code: string): Promise<void> {
    if (code === DEMO_EXPIRED_CODE || code !== DEMO_OTP_CODE) throw new RepoError('otp_invalid_or_expired');
    await this.store.setJson('demo-auth', { signedIn: true });
    await this.emit();
  }
  async signOut(): Promise<void> {
    await this.store.remove('demo-auth');
    await this.emit();
  }
  async deleteAccount(): Promise<void> {
    // デモ：模擬ログイン状態とデモの報告を端末から消すだけ（サーバーのアカウントは存在しない）
    await this.store.remove('demo-auth');
    await this.store.remove('demo-reports');
    await this.store.remove(DEMO_UGC_KEY);
    await this.emit();
  }
}

/** デモの報告は端末内に保存するだけ。送信済みとは表示しない */
export class DemoReports implements ReportService {
  constructor(
    private store: LocalStore,
    private auth: AuthService,
  ) {}
  async submit(input: ReportInput): Promise<ReportResult> {
    const state = await this.auth.getState();
    if (!state.signedIn) throw new RepoError('auth_required');
    const errors = validateReportInput(input, new Date());
    if (errors.length) throw new RepoError('validation', errors.join(','));
    const list = (await this.store.getJson<(ReportInput & { id: string })[]>('demo-reports')) ?? [];
    const dup = list.find((r) => r.requestId === input.requestId);
    if (dup) return { id: dup.id, storedAt: 'demo_local' };
    const id = `demo-report-${list.length + 1}`;
    await this.store.setJson('demo-reports', [...list, { ...input, id }]);
    return { id, storedAt: 'demo_local' };
  }
}

export const DEMO_UGC_KEY = 'demo-ugc';
/** デモの写真は端末内に保存するため件数を絞る */
export const DEMO_PHOTO_MAX = 6;
const DEMO_DAILY_LIMIT = 5;

interface DemoUgcState {
  reviews: (Review & { requestId: string; createdAt: string })[];
  photos: (UserPhoto & { requestId: string; createdAt: string })[];
  flags: { target: 'review' | 'photo'; id: string; reason: FlagReason }[];
}

/**
 * デモの口コミ・写真：端末内だけに保存し、どこにも送信しない。
 * 投稿後すぐ公開（本番の初期設定と同じ）。通報はこの端末で非表示にするだけ。
 */
export class DemoUgc implements UgcService {
  private seeded: Review[];
  constructor(
    private store: LocalStore,
    private auth: AuthService,
    now: Date = new Date(),
  ) {
    this.seeded = createDemoReviews(now);
  }

  private async state(): Promise<DemoUgcState> {
    const s = await this.store.getJson<DemoUgcState>(DEMO_UGC_KEY);
    return { reviews: s?.reviews ?? [], photos: s?.photos ?? [], flags: s?.flags ?? [] };
  }
  private async requireSignedIn() {
    if (!(await this.auth.getState()).signedIn) throw new RepoError('auth_required');
  }
  private flagged(st: DemoUgcState, target: 'review' | 'photo', id: string) {
    return st.flags.some((f) => f.target === target && f.id === id);
  }
  private todayCount(items: { createdAt: string }[]) {
    const today = toJst(new Date()).date;
    return items.filter((i) => toJst(new Date(i.createdAt)).date === today).length;
  }

  async counts(placeIds: string[]): Promise<Record<string, UgcCounts>> {
    const st = await this.state();
    const out: Record<string, UgcCounts> = {};
    for (const id of placeIds) {
      const reviews = [...this.seeded, ...st.reviews].filter((r) => r.placeId === id && !this.flagged(st, 'review', r.id));
      const photos = st.photos.filter((p) => p.placeId === id && !this.flagged(st, 'photo', p.id));
      if (reviews.length || photos.length) out[id] = { reviewCount: reviews.length, photoCount: photos.length };
    }
    return out;
  }

  async listReviews(placeId: string): Promise<Review[]> {
    const st = await this.state();
    const mine = st.reviews.filter((r) => r.placeId === placeId).map(({ requestId: _r, createdAt: _c, ...rest }) => rest);
    const seeded = this.seeded.filter((r) => r.placeId === placeId && !this.flagged(st, 'review', r.id));
    return [...mine, ...seeded].sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''));
  }

  async listPhotos(placeId: string): Promise<UserPhoto[]> {
    const st = await this.state();
    return st.photos
      .filter((p) => p.placeId === placeId)
      .map(({ requestId: _r, createdAt: _c, ...rest }) => rest)
      .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''));
  }

  async submitReview(i: ReviewInput): Promise<UgcSubmitResult> {
    await this.requireSignedIn();
    const errors = validateReview(i, toJst(new Date()).date);
    if (errors.length) throw new RepoError('validation', errors.join(','));
    const st = await this.state();
    const dup = st.reviews.find((r) => r.requestId === i.requestId);
    if (dup) return { id: dup.id, status: dup.status, storedAt: 'demo_local' };
    if (this.todayCount(st.reviews) >= DEMO_DAILY_LIMIT) throw new RepoError('rate_limited');
    const now = new Date().toISOString();
    const review = {
      id: `demo-my-review-${Date.now()}`,
      placeId: i.placeId,
      nickname: i.nickname.trim(),
      body: i.body.trim(),
      tags: i.tags,
      visitedOn: i.visitedOn,
      publishedAt: now,
      mine: true,
      status: 'approved' as const,
      requestId: i.requestId,
      createdAt: now,
    };
    await this.store.setJson(DEMO_UGC_KEY, { ...st, reviews: [...st.reviews, review] });
    return { id: review.id, status: review.status, storedAt: 'demo_local' };
  }

  async submitPhoto(i: PhotoInput): Promise<UgcSubmitResult> {
    await this.requireSignedIn();
    if (!i.image.dataUri) throw new RepoError('validation', 'image');
    if (i.caption.length > 100) throw new RepoError('validation', 'caption');
    const st = await this.state();
    const dup = st.photos.find((p) => p.requestId === i.requestId);
    if (dup) return { id: dup.id, status: dup.status, storedAt: 'demo_local' };
    if (this.todayCount(st.photos) >= DEMO_DAILY_LIMIT || st.photos.length >= DEMO_PHOTO_MAX) throw new RepoError('rate_limited');
    const now = new Date().toISOString();
    const id = `demo-my-photo-${Date.now()}`;
    const photo = {
      id,
      placeId: i.placeId,
      url: i.image.dataUri,
      caption: i.caption.trim() || null,
      publishedAt: now,
      mine: true,
      status: 'approved' as const,
      storagePath: `demo/${id}.jpg`,
      requestId: i.requestId,
      createdAt: now,
    };
    await this.store.setJson(DEMO_UGC_KEY, { ...st, photos: [...st.photos, photo] });
    return { id, status: photo.status, storedAt: 'demo_local' };
  }

  async deleteReview(id: string): Promise<void> {
    await this.requireSignedIn();
    const st = await this.state();
    await this.store.setJson(DEMO_UGC_KEY, { ...st, reviews: st.reviews.filter((r) => r.id !== id) });
  }

  async deletePhoto(photo: UserPhoto): Promise<void> {
    await this.requireSignedIn();
    const st = await this.state();
    await this.store.setJson(DEMO_UGC_KEY, { ...st, photos: st.photos.filter((p) => p.id !== photo.id) });
  }

  async flag(target: 'review' | 'photo', id: string, reason: FlagReason): Promise<void> {
    await this.requireSignedIn();
    const st = await this.state();
    if (this.flagged(st, target, id)) return;
    await this.store.setJson(DEMO_UGC_KEY, { ...st, flags: [...st.flags, { target, id, reason }] });
  }
}

export function createDemoBackend(store: LocalStore, now = new Date()): Backend {
  const auth = new DemoAuth(store);
  const places = new DemoRepository(now);
  const ugc = new DemoUgc(store, auth, now);
  places.ugc = ugc;
  return { mode: 'demo', places, auth, reports: new DemoReports(store, auth), ugc };
}
