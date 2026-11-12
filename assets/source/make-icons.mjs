// アプリアイコン・起動画面の画像を SVG から書き出す（写真や他社素材は使わない、図形だけのオリジナル）
// 使い方: node assets/source/make-icons.mjs  （Playwright の Chromium で PNG に変換）
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// playwright はプロジェクトの依存に入れず、グローバルに入っているものを使う
const { chromium } = createRequire(import.meta.url)('playwright');

const out = join(dirname(fileURLToPath(import.meta.url)), '..');

const BG = `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#15A091"/><stop offset="0.55" stop-color="#0B7A70"/><stop offset="1" stop-color="#065A52"/></linearGradient></defs>
  <rect width="1024" height="1024" fill="url(#g)"/>`;

/** 白いアーチ（涼しい室内の入口）＋ 冷気の波 ＋ 犬の顔。color=false で単色シルエット */
function art(color = true) {
  const arch = color ? '#FFFFFF' : '#FFFFFF';
  const dog = color ? '#0B7A70' : '#000000';
  const ear = color ? '#075E56' : '#000000';
  const wave = color ? '#5CC4B6' : '#000000';
  const muzzle = color ? '#E1F2EE' : '#FFFFFF';
  const ink = color ? '#11231F' : '#000000';
  return `
  <path d="M282 828 V478 A230 230 0 0 1 742 478 V828 Z" fill="${arch}"/>
  <g fill="none" stroke="${wave}" stroke-width="20" stroke-linecap="round">
    <path d="M402 360 q27 -24 54 0 t54 0 t54 0 t54 0"/>
    <path d="M432 412 q27 -24 54 0 t54 0 t54 0"/>
  </g>
  <ellipse cx="404" cy="594" rx="56" ry="104" transform="rotate(18 404 594)" fill="${ear}"/>
  <ellipse cx="620" cy="594" rx="56" ry="104" transform="rotate(-18 620 594)" fill="${ear}"/>
  <circle cx="512" cy="622" r="128" fill="${dog}"/>
  <ellipse cx="512" cy="676" rx="72" ry="54" fill="${muzzle}"/>
  <ellipse cx="512" cy="650" rx="25" ry="18" fill="${ink}"/>
  <circle cx="462" cy="596" r="15" fill="${color ? '#FFFFFF' : '#FFFFFF'}"/>
  <circle cx="562" cy="596" r="15" fill="${color ? '#FFFFFF' : '#FFFFFF'}"/>
  <path d="M492 700 q20 16 40 0" fill="none" stroke="${ink}" stroke-width="9" stroke-linecap="round"/>`;
}

const svg = (body, size = 1024) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1024 1024">${body}</svg>`;
// Android のアダプティブアイコンは中央66%だけが確実に見えるので縮めて配置
const shrink = (body, s) => `<g transform="translate(${512 - 512 * s} ${512 - 512 * s}) scale(${s})">${body}</g>`;

const files = {
  'icon.png': [svg(BG + art()), 1024],
  'favicon.png': [svg(BG + art()), 48],
  'android-icon-background.png': [svg(BG), 512],
  'android-icon-foreground.png': [svg(shrink(art(), 0.78)), 512],
  // 単色アイコン：白い部分＝表示、透明＝背景（OSが色を付ける）
  'android-icon-monochrome.png': [svg(shrink(`<mask id="m">${art(false).replaceAll('#000000', '#000').replaceAll('#FFFFFF', '#fff')}</mask><rect width="1024" height="1024" fill="#fff" mask="url(#m)"/>`, 0.78)), 432],
  'splash-icon.png': [svg(art()), 1024],
};

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, [s, size]] of Object.entries(files)) {
  writeFileSync(join(out, 'source', name.replace('.png', '.svg')), s);
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${s.replace(/width="\d+" height="\d+"/, `width="${size}" height="${size}"`)}</body></html>`);
  await page.locator('svg').screenshot({ path: join(out, name), omitBackground: true });
  console.log('wrote', name, size);
}
await browser.close();
