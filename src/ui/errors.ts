import { RepoError } from '@/data/repository';

/** 利用者向けの文言。データベース名・API設定などの技術情報は出さない */
export function errorMessage(e: unknown, prefix = ''): string {
  const kind = e instanceof RepoError ? e.kind : 'server';
  const body: Record<RepoError['kind'], string> = {
    network: '通信できませんでした。電波の良い場所で再試行してください。',
    config: '現在ご利用いただけません。時間をおいてお試しください。',
    server: '一時的な問題が発生しました。時間をおいて再試行してください。',
    auth_required: 'ログインが必要です。メールアドレスの確認からやり直してください。',
    rate_limited: '本日の送信上限に達しました。明日以降に再度お送りください。',
    validation: '入力内容を確認してください。',
    otp_invalid_or_expired: 'コードが正しくないか、有効期限が切れています。コードを再送してください。',
    otp_send_limited: 'コードの送信回数が多すぎます。少し時間をおいて再送してください。',
  };
  if (__DEV__ && e instanceof RepoError && e.devDetail) console.warn(`[repo] ${e.kind}: ${e.devDetail}`);
  return `${prefix}${body[kind]}`;
}
