import type { LatLng } from '@/domain/geo';
import type { Area, Place, Station } from '@/domain/types';
import type {
  FlagReason,
  PhotoInput,
  Review,
  ReviewInput,
  UgcCounts,
  UgcSubmitResult,
  UserPhoto,
} from '@/domain/ugc';

export type DataMode = 'demo' | 'production';

export type RepoErrorKind =
  | 'network' // 通信できない
  | 'config' // 設定不足（利用者には技術情報を出さない）
  | 'server'
  | 'auth_required'
  | 'rate_limited'
  | 'validation'
  | 'otp_invalid_or_expired'
  | 'otp_send_limited';

export class RepoError extends Error {
  constructor(
    public kind: RepoErrorKind,
    /** 開発ログ用。トークン・メール・位置を含めない */
    public devDetail?: string,
  ) {
    super(kind);
    this.name = 'RepoError';
  }
}

export interface PlacesByIdsResult {
  found: Place[];
  /** 取得は正常終了したが、公開情報として見つからなかったID（非公開化・削除） */
  missingIds: string[];
}

/** 画面から見たデータ取得の窓口。DemoRepository と SupabaseRepository が同じ形で実装する */
export interface PlaceRepository {
  readonly mode: DataMode;
  /** 市区町村（エリア）。都道府県コードを指定するとその都道府県だけ */
  listAreas(prefectureCode?: number): Promise<Area[]>;
  /** 駅名の前方・部分一致検索（最大30件） */
  searchStations(query: string): Promise<Station[]>;
  /** 基準点から半径 km の範囲にある公開済み施設（全国。範囲外は返さない） */
  listPlacesNear(center: LatLng, radiusKm: number): Promise<Place[]>;
  /** 一覧用の公開中の口コミ・写真の件数 */
  getUgcCounts(placeIds: string[]): Promise<Record<string, UgcCounts>>;
  getPlace(id: string): Promise<Place | null>;
  getPlacesByIds(ids: string[]): Promise<PlacesByIdsResult>;
}

export type ReportType = 'correction' | 'dog_ok_vote';

export type ReportTargetField =
  | 'dog_zone'
  | 'indoor_dogs'
  | 'air_conditioning'
  | 'dog_conditions'
  | 'usage_conditions'
  | 'hours'
  | 'contact'
  | 'closed'
  | 'other';

/** 犬が大丈夫なお店かの投票（運営確認用。公開・自動反映しない） */
export type DogOkVoteChoice =
  | 'indoor_ok' // 室内で犬と過ごせた
  | 'cart_or_bag_needed' // カート・バッグ等が必要だった
  | 'terrace_only' // テラスのみだった
  | 'not_allowed' // 犬は入れなかった
  | 'unsure'; // わからなかった

export interface ReportInput {
  requestId: string; // 再送時の重複防止
  placeId: string;
  type: ReportType;
  targetField: ReportTargetField | null;
  voteChoice: DogOkVoteChoice | null;
  body: string;
  visitedOn: string | null; // YYYY-MM-DD
}

export interface ReportResult {
  id: string;
  /** 'server' は本番サーバーに保存済み。'demo_local' はデモの端末内保存（送信していない） */
  storedAt: 'server' | 'demo_local';
}

export interface AuthState {
  signedIn: boolean;
  /** 画面表示用（メールの一部を伏せる） */
  maskedEmail: string | null;
  /** デモの模擬ログインか */
  simulated: boolean;
}

export interface AuthService {
  getState(): Promise<AuthState>;
  subscribe(cb: (s: AuthState) => void): () => void;
  sendOtp(email: string): Promise<void>;
  verifyOtp(email: string, code: string): Promise<void>;
  signOut(): Promise<void>;
  /** サーバー側で本人確認のうえ Auth ユーザーと本人の報告・口コミ・写真を削除する */
  deleteAccount(): Promise<void>;
}

export interface ReportService {
  submit(input: ReportInput): Promise<ReportResult>;
}

/** 口コミ・犬の写真。投稿はログイン必須。閲覧はログイン不要 */
export interface UgcService {
  /** 公開中の口コミ（新しい順）。ログイン中は自分の確認待ち・非表示の投稿も mine: true で含む */
  listReviews(placeId: string): Promise<Review[]>;
  listPhotos(placeId: string): Promise<UserPhoto[]>;
  submitReview(input: ReviewInput): Promise<UgcSubmitResult>;
  submitPhoto(input: PhotoInput): Promise<UgcSubmitResult>;
  deleteReview(id: string): Promise<void>;
  deletePhoto(photo: UserPhoto): Promise<void>;
  flag(target: 'review' | 'photo', id: string, reason: FlagReason): Promise<void>;
}

export interface Backend {
  mode: DataMode;
  places: PlaceRepository;
  auth: AuthService;
  reports: ReportService;
  ugc: UgcService;
}

export function maskEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const [user, domain] = email.split('@');
  if (!domain) return null;
  return `${user.slice(0, 1)}***@${domain}`;
}

export const REPORT_BODY_MAX = 1000;
