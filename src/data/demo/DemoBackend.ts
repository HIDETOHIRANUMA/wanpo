import type { Area, Place, Station } from '@/domain/types';
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
} from '../repository';
import { validateReportInput } from '../reportValidation';
import { AREAS, STATIONS } from './areas';
import { createDemoPlaces } from './places';

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

  async listAreas(): Promise<Area[]> {
    return AREAS;
  }
  async listStations(): Promise<Station[]> {
    return STATIONS;
  }
  async listPublishedPlaces(): Promise<Place[]> {
    await this.delay();
    return this.published();
  }
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

export function createDemoBackend(store: LocalStore, now = new Date()): Backend {
  const auth = new DemoAuth(store);
  return { mode: 'demo', places: new DemoRepository(now), auth, reports: new DemoReports(store, auth) };
}
