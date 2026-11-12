// 暑さ指数（WBGT）の予測を返す（Supabase Edge Function / Deno）
// - 入力は地点番号（5桁）だけ。利用者の位置は受け取らない（最寄り地点の選択は端末側）
// - 取得元：環境省 熱中症予防情報サイトの予測値 CSV（yohou_<地点番号>.csv）
//   出典表示はアプリ側で行う。提供は例年4月下旬〜10月下旬で、期間外は off_season を返す
// - 取得元の URL は環境変数 WBGT_BASE_URL（末尾 /）。未設定なら not_configured を返す
//   （商用利用の可否を環境省に確認してから設定する）
// - 取得結果は 30 分キャッシュする（private.wbgt_cache、service role 専用の関数経由）
//
// デプロイ: npx supabase functions deploy heat-index --no-verify-jwt
//           npx supabase secrets set WBGT_BASE_URL=https://.../
import { createClient } from 'npm:@supabase/supabase-js@2.119.0';

const CACHE_SECONDS = 30 * 60;
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type Hourly = { at: string; wbgt: number };
type Payload =
  | { status: 'ok'; issued_at: string | null; hourly: Hourly[] }
  | { status: 'unavailable'; reason: 'off_season' | 'not_configured' | 'no_point' };

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  let pointId = '';
  try {
    const body = await req.json();
    pointId = typeof body?.point_id === 'string' ? body.point_id : '';
  } catch {
    return json(400, { error: 'bad_request' });
  }
  if (!/^\d{5}$/.test(pointId)) return json(400, { error: 'bad_request' });

  const base = Deno.env.get('WBGT_BASE_URL');
  if (!base) return json(200, { status: 'unavailable', reason: 'not_configured' });

  const url = Deno.env.get('SUPABASE_URL');
  const secret = Deno.env.get('SUPABASE_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const admin = url && secret ? createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } }) : null;

  // 登録済みの地点だけを受け付ける（任意の番号で取得元へ問い合わせさせない）
  if (admin) {
    const { data, error } = await admin.from('wbgt_points').select('id').eq('id', pointId).maybeSingle();
    if (error) {
      console.error('heat-index: point lookup failed', error.code);
      return json(500, { error: 'server_error' });
    }
    if (!data) return json(200, { status: 'unavailable', reason: 'no_point' });

    const cached = await admin.rpc('wbgt_cache_get', { p_point_id: pointId, p_max_age_seconds: CACHE_SECONDS });
    if (!cached.error && cached.data && typeof cached.data === 'object') return json(200, cached.data as Record<string, unknown>);
  }

  const payload = await fetchForecast(base, pointId);
  if (!payload) return json(502, { error: 'upstream_failed' });
  if (admin) {
    const put = await admin.rpc('wbgt_cache_put', { p_point_id: pointId, p_payload: payload });
    if (put.error) console.error('heat-index: cache write failed', put.error.code);
  }
  return json(200, payload);
});

async function fetchForecast(base: string, pointId: string): Promise<Payload | null> {
  const target = `${base.endsWith('/') ? base : `${base}/`}yohou_${pointId}.csv`;
  let res: Response;
  try {
    res = await fetch(target, { headers: { 'User-Agent': 'inu-to-suzumeru-heat/1.0' }, signal: AbortSignal.timeout(8000) });
  } catch {
    console.error('heat-index: upstream unreachable');
    return null;
  }
  if (res.status === 404) return { status: 'unavailable', reason: 'off_season' };
  if (!res.ok) {
    console.error('heat-index: upstream status', res.status);
    return null;
  }
  const parsed = parseWbgtForecastCsv(await res.text(), pointId);
  if (!parsed) return { status: 'unavailable', reason: 'off_season' };
  // 古すぎる予測（期間終了後に残っているファイル）は使わない
  const last = Date.parse(parsed.hourly[parsed.hourly.length - 1].at);
  if (Number.isNaN(last) || last < Date.now() - 6 * 3_600_000) return { status: 'unavailable', reason: 'off_season' };
  return { status: 'ok', issued_at: parsed.issuedAt, hourly: parsed.hourly };
}

// ---- 以下は src/domain/heat.ts の parseWbgtForecastCsv と同じ処理（Deno から import できないため複製） ----
function parseWbgtForecastCsv(text: string, pointId: string): { issuedAt: string | null; hourly: Hourly[] } | null {
  const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.trim() !== '');
  if (lines.length < 2) return null;
  const head = lines[0].split(',').map((c) => c.trim());
  const row = lines.slice(1).map((l) => l.split(',').map((c) => c.trim())).find((r) => r[0] === pointId);
  if (!row) return null;
  const hourly: Hourly[] = [];
  for (let i = 2; i < head.length; i++) {
    const m = /^(\d{4})(\d{2})(\d{2})(\d{2})$/.exec(head[i]);
    const raw = row[i];
    if (!m || raw === undefined || raw === '' || !/^-?\d+$/.test(raw)) continue;
    const [, y, mo, d, hh] = m;
    const base = Date.parse(`${y}-${mo}-${d}T00:00:00+09:00`);
    if (Number.isNaN(base) || Number(hh) > 24) continue;
    const v = Number(raw) / 10;
    if (v < 0 || v > 45) continue;
    hourly.push({ at: new Date(base + Number(hh) * 3_600_000).toISOString(), wbgt: v });
  }
  if (hourly.length === 0) return null;
  hourly.sort((a, b) => a.at.localeCompare(b.at));
  return { issuedAt: parseIssued(row[1]), hourly };
}

function parseIssued(s: string | undefined): string | null {
  if (!s) return null;
  const a = /^(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})/.exec(s);
  const b = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(s);
  const p = a ?? b;
  if (!p) return null;
  const pad = (x: string) => x.padStart(2, '0');
  const t = Date.parse(`${p[1]}-${pad(p[2])}-${pad(p[3])}T${pad(p[4])}:${p[5]}:00+09:00`);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}
