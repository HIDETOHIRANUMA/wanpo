// Web プレビュー（デモ）を1つの HTML にまとめる。共有用の確認ページ向け。
// 使い方: node scripts/build-web-preview.mjs  → dist-web-preview/index.html
// ※ Web で動くことは iOS / Android の動作確認の代わりにならない。
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const out = 'dist-web-preview-raw';
rmSync(out, { recursive: true, force: true });
execSync(`npx expo export --platform web --output-dir ${out} --clear`, {
  stdio: 'inherit',
  env: { ...process.env, WEB_PREVIEW: '1', EXPO_PUBLIC_DATA_MODE: 'demo', CI: '1' },
});
// アイコンのフォントなど、JS から参照される静的ファイルを data: URI に埋め込む（1ファイルで動かすため）
const MIME = { ttf: 'font/ttf', otf: 'font/otf', png: 'image/png', jpg: 'image/jpeg' };
function inlineAssets(js) {
  return js.replace(/"(\/assets\/[^"]+\.(ttf|otf|png|jpg))"/g, (_m, path, ext) => {
    const data = readFileSync(join(out, path)).toString('base64');
    return `"data:${MIME[ext]};base64,${data}"`;
  });
}
let html = readFileSync(join(out, 'index.html'), 'utf8');
html = html.replace(/<script src="(\/_expo\/[^"]+)"[^>]*><\/script>/g, (_m, src) => {
  const js = inlineAssets(readFileSync(join(out, src), 'utf8')).replace(/<\/script/gi, '<\\/script');
  return `<script>${js}</script>`;
});
html = html.replace(/<link rel="icon"[^>]*>/g, '');
html = html.replace(/<title>[^<]*<\/title>/, '<title>犬と涼める デモ</title>');
if (/src="\/_expo\//.test(html)) throw new Error('外部スクリプトが残っています');
mkdirSync('dist-web-preview', { recursive: true });
writeFileSync('dist-web-preview/index.html', html);
rmSync(out, { recursive: true, force: true });
console.log(`dist-web-preview/index.html (${(html.length / 1024 / 1024).toFixed(2)} MB)`);
