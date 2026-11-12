// アカウント削除（Supabase Edge Function / Deno）
// - 呼び出し元のアクセストークンでサーバー側が本人を検証し、そのユーザーだけを削除する
// - auth.users 削除で public.place_reports（本人の報告）と private.report_quota が FK の cascade で削除される
// - 秘密鍵（service role / secret）は Edge Function の環境にのみ存在し、アプリには含めない
//
// デプロイ: npx supabase functions deploy delete-account
// supabase/config.toml で verify_jwt = false にしている（新しい publishable/secret キー方式では
// ゲートウェイでの JWT 検証に頼らず、関数内で getUser により検証する）。
import { createClient } from 'npm:@supabase/supabase-js@2.119.0';

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) return json(401, { error: 'auth_required' });

  const url = Deno.env.get('SUPABASE_URL');
  // 新方式の secret key を優先し、なければ従来の service role key を使う
  const secret = Deno.env.get('SUPABASE_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !secret) {
    console.error('delete-account: server keys are not configured');
    return json(500, { error: 'server_not_configured' });
  }

  const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });

  // トークンから本人を特定（リクエスト本文のユーザーIDは使わない）
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return json(401, { error: 'auth_required' });

  const { error: delError } = await admin.auth.admin.deleteUser(data.user.id);
  if (delError) {
    // ユーザーIDやメールはログに出さない
    console.error('delete-account: deleteUser failed', delError.status ?? '');
    return json(500, { error: 'delete_failed' });
  }
  return json(200, { deleted: true });
});
