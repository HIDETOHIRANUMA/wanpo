/**
 * デザインの土台（色・余白・角丸・影・文字）。
 * ブランド：日陰の涼しさを表すティール（primary）と、犬のぬくもりを表すアプリコット（accent）。
 * 状態色は必ず文字ラベルとアイコンを併用する（色だけで意味を伝えない）。
 */
export const colors = {
  bg: '#F3F6F5',
  surface: '#FFFFFF',
  surfaceAlt: '#EDF3F1',
  primary: '#0B7A70',
  primaryPressed: '#085F57',
  primarySoft: '#E1F2EE',
  primaryInk: '#064A44',
  accent: '#E8833A',
  accentSoft: '#FDEFE2',
  heart: '#E0464B',
  text: '#11231F',
  textMuted: '#566763',
  textSubtle: '#879793',
  mint: '#E1F2EE',
  border: '#E1E8E6',
  borderStrong: '#C7D5D1',
  overlay: 'rgba(8,26,23,0.62)',
  ok: '#0B7A70',
  okBg: '#E1F2EE',
  warn: '#8F5400',
  warnBg: '#FFF3DD',
  bad: '#B42318',
  badBg: '#FDECEA',
  neutral: '#4B5B57',
  neutralBg: '#EDF2F0',
  demo: '#5B3B8C',
  demoBg: '#F1ECF8',
  disabled: '#9AAAA6',
  white: '#FFFFFF',
};

export const space = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 };
export const MIN_TAP = 48;

/** 影（新アーキテクチャと Web の boxShadow を使う） */
export const shadow = {
  card: { boxShadow: '0px 2px 10px rgba(12, 44, 38, 0.07)' },
  raised: { boxShadow: '0px 6px 20px rgba(12, 44, 38, 0.12)' },
  bar: { boxShadow: '0px -4px 16px rgba(12, 44, 38, 0.08)' },
} as const;

export const type = {
  display: { fontSize: 28, lineHeight: 36, fontWeight: '800' as const, color: colors.text, letterSpacing: 0.2 },
  title: { fontSize: 22, lineHeight: 30, fontWeight: '700' as const, color: colors.text },
  heading: { fontSize: 17, lineHeight: 24, fontWeight: '700' as const, color: colors.text },
  body: { fontSize: 15, lineHeight: 23, color: colors.text },
  small: { fontSize: 13, lineHeight: 19, color: colors.textMuted },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '600' as const, color: colors.text },
  caption: { fontSize: 12, lineHeight: 16, color: colors.textMuted },
  overline: { fontSize: 11, lineHeight: 14, fontWeight: '700' as const, color: colors.textSubtle, letterSpacing: 0.8 },
};
