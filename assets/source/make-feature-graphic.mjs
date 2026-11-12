// Google Play のフィーチャーグラフィック（1024×500）を書き出す。アイコンと同じ図形を使う
// 使い方: node assets/source/make-feature-graphic.mjs （Google Fonts の M PLUS Rounded 1c を読み込むためネット接続が必要）
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = createRequire(import.meta.url)('playwright');
const here = dirname(fileURLToPath(import.meta.url));
const mark = readFileSync(join(here, 'splash-icon.svg'), 'utf8').replace(/width="\d+" height="\d+"/, 'width="360" height="360"');

const html = `<html><head>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=M+PLUS+Rounded+1c:wght@500;800&display=swap">
<style>
body{margin:0;width:1024px;height:500px;overflow:hidden;font-family:'M PLUS Rounded 1c',sans-serif;
 background:linear-gradient(135deg,#15A091 0%,#0B7A70 55%,#065A52 100%);color:#fff;display:flex;align-items:center}
.t{padding-left:72px;flex:1}
h1{margin:0;font-size:88px;font-weight:800;letter-spacing:4px}
p{margin:18px 0 0;font-size:32px;font-weight:500;opacity:.92;line-height:1.5}
.m{width:360px;height:360px;margin-right:56px;display:flex}
</style></head><body><div class="t"><h1>犬と涼める</h1><p>暑い日は、犬と一緒に<br>冷房の効いた室内へ。</p></div><div class="m">${mark}</div></body></html>`;

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1024, height: 500 } });
await p.setContent(html, { waitUntil: 'networkidle' });
await p.evaluate(() => document.fonts.ready);
await p.screenshot({ path: join(here, '..', 'store', 'feature-graphic.png') });
await b.close();
console.log('wrote assets/store/feature-graphic.png');
