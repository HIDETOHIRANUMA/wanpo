// デモ用の「犬の写真」の代わりに使うイラスト（図形だけ。実在の写真に見えないもの）を作り、
// src/data/demo/dogIllustrations.ts に data URI として書き出す。
// 使い方: node assets/source/make-demo-dogs.mjs
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = createRequire(import.meta.url)('playwright');
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const DOGS = [
  { key: 'poodle', bg: '#FCE9DC', fur: '#B9784A', ear: '#9A5E36', muzzle: '#E8C3A2', curly: true },
  { key: 'shiba', bg: '#E1F2EE', fur: '#D9893B', ear: '#C06F25', muzzle: '#FFF3E4', pointy: true },
  { key: 'frenchie', bg: '#E6ECF7', fur: '#7E8794', ear: '#5F6873', muzzle: '#C9CED6', bat: true },
  { key: 'golden', bg: '#FFF4D6', fur: '#E2B15A', ear: '#C9933A', muzzle: '#F6DDA8' },
  { key: 'dachs', bg: '#F3E6F5', fur: '#8A4B2A', ear: '#6B3519', muzzle: '#C88B66', long: true },
  { key: 'collie', bg: '#E4F1FB', fur: '#2C2C30', ear: '#1D1D20', muzzle: '#FFFFFF', blaze: true },
];

function svg(d) {
  const ears = d.pointy
    ? `<path d="M120 120 L150 40 L185 115 Z" fill="${d.ear}"/><path d="M280 120 L250 40 L215 115 Z" fill="${d.ear}"/>`
    : d.bat
      ? `<ellipse cx="135" cy="85" rx="38" ry="60" transform="rotate(-20 135 85)" fill="${d.ear}"/><ellipse cx="265" cy="85" rx="38" ry="60" transform="rotate(20 265 85)" fill="${d.ear}"/>`
      : `<ellipse cx="110" cy="${d.long ? 210 : 180}" rx="42" ry="${d.long ? 100 : 80}" transform="rotate(15 110 180)" fill="${d.ear}"/><ellipse cx="290" cy="${d.long ? 210 : 180}" rx="42" ry="${d.long ? 100 : 80}" transform="rotate(-15 290 180)" fill="${d.ear}"/>`;
  const curls = d.curly
    ? [0, 1, 2, 3, 4].map((i) => `<circle cx="${140 + i * 30}" cy="${92 + (i % 2) * 8}" r="26" fill="${d.fur}"/>`).join('')
    : '';
  const blaze = d.blaze ? `<path d="M185 90 Q200 70 215 90 L225 230 L175 230 Z" fill="#FFFFFF"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
  <rect width="400" height="400" fill="${d.bg}"/>
  <circle cx="200" cy="420" r="190" fill="#FFFFFF" opacity="0.55"/>
  ${ears}
  <circle cx="200" cy="190" r="105" fill="${d.fur}"/>
  ${curls}${blaze}
  <ellipse cx="200" cy="240" rx="60" ry="46" fill="${d.muzzle}"/>
  <ellipse cx="200" cy="218" rx="20" ry="14" fill="#1E1E22"/>
  <circle cx="160" cy="175" r="12" fill="#1E1E22"/><circle cx="240" cy="175" r="12" fill="#1E1E22"/>
  <circle cx="164" cy="171" r="4" fill="#FFFFFF"/><circle cx="244" cy="171" r="4" fill="#FFFFFF"/>
  <path d="M182 258 q18 14 36 0" fill="none" stroke="#1E1E22" stroke-width="7" stroke-linecap="round"/>
  <ellipse cx="200" cy="280" rx="16" ry="12" fill="#F28B9B"/>
</svg>`;
}

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 400, height: 400 } });
const out = {};
for (const d of DOGS) {
  await p.setContent(`<body style="margin:0">${svg(d)}</body>`);
  const buf = await p.locator('svg').screenshot({ type: 'jpeg', quality: 80 });
  out[d.key] = `data:image/jpeg;base64,${buf.toString('base64')}`;
}
await b.close();
const body = Object.entries(out).map(([k, v]) => `  ${k}: '${v}',`).join('\n');
writeFileSync(
  join(root, 'src/data/demo/dogIllustrations.ts'),
  `// 自動生成（assets/source/make-demo-dogs.mjs）。デモ用の犬のイラスト（写真ではない）\nexport const DOG_ILLUSTRATIONS = {\n${body}\n} as const;\n\nexport type DogIllustrationKey = keyof typeof DOG_ILLUSTRATIONS;\n`,
);
console.log('wrote', Object.keys(out).length, 'illustrations');
