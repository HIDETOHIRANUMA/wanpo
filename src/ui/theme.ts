export const colors = {
  bg: '#F7FAF8',
  primary: '#0F766E',
  primaryPressed: '#0B5A54',
  text: '#16352E',
  textMuted: '#4A635C',
  surface: '#FFFFFF',
  mint: '#E8F5F2',
  border: '#CFE3DD',
  // 状態色は必ず文字ラベルと併用する
  ok: '#0F766E',
  okBg: '#E8F5F2',
  warn: '#8A5A00',
  warnBg: '#FFF4DB',
  bad: '#9F1D1D',
  badBg: '#FDECEC',
  neutral: '#4A5A56',
  neutralBg: '#EEF2F1',
  demo: '#5B3B8C',
  demoBg: '#F1ECF8',
  disabled: '#9AAEA8',
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };
export const radius = { sm: 6, md: 10, lg: 14 };
export const MIN_TAP = 48;

export const type = {
  title: { fontSize: 22, fontWeight: '700' as const, color: colors.text },
  heading: { fontSize: 18, fontWeight: '700' as const, color: colors.text },
  body: { fontSize: 16, color: colors.text, lineHeight: 24 },
  small: { fontSize: 14, color: colors.textMuted, lineHeight: 20 },
  label: { fontSize: 14, fontWeight: '600' as const, color: colors.text },
};
