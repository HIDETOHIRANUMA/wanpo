import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { CATEGORY_LABEL } from '@/domain/labels';
import type { PlaceCategory } from '@/domain/types';
import { colors, MIN_TAP, radius, shadow, space, type } from './theme';
import type { BadgeInfo, Tone } from './status';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];

/** 装飾用アイコン（読み上げ対象外）。意味は必ず隣の文字で伝える */
export function Icon({ name, size = 18, color = colors.textMuted, style }: { name: IconName; size?: number; color?: string; style?: StyleProp<any> }) {
  return <Ionicons name={name} size={size} color={color} style={style} accessibilityElementsHidden importantForAccessibility="no" />;
}

const toneStyle: Record<Tone, { fg: string; bg: string; icon: IconName }> = {
  ok: { fg: colors.ok, bg: colors.okBg, icon: 'checkmark-circle' },
  warn: { fg: colors.warn, bg: colors.warnBg, icon: 'alert-circle' },
  bad: { fg: colors.bad, bg: colors.badBg, icon: 'close-circle' },
  neutral: { fg: colors.neutral, bg: colors.neutralBg, icon: 'time-outline' },
  demo: { fg: colors.demo, bg: colors.demoBg, icon: 'sparkles' },
};

/** 色だけに頼らず、アイコンと文字で状態を示す */
export function Badge({ info, style, size = 'md' }: { info: BadgeInfo; style?: ViewStyle; size?: 'sm' | 'md' }) {
  const t = toneStyle[info.tone];
  return (
    <View
      style={[styles.badge, size === 'sm' && styles.badgeSm, { backgroundColor: t.bg }, style]}
      accessible
      accessibilityLabel={info.label}
    >
      <Icon name={t.icon} size={size === 'sm' ? 13 : 15} color={t.fg} />
      <Text style={[styles.badgeText, size === 'sm' && { fontSize: 12 }, { color: t.fg }]}>{info.label}</Text>
    </View>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  size = 'md',
  disabled,
  disabledReason,
  loading,
  accessibilityHint,
  style,
}: {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  disabledReason?: string;
  loading?: boolean;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const isDisabled = disabled || loading || !onPress;
  const v = buttonVariants[variant];
  const fg = isDisabled ? colors.disabled : v.fg;
  return (
    <View style={style}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={isDisabled && disabledReason ? disabledReason : accessibilityHint}
        accessibilityState={{ disabled: isDisabled, busy: !!loading }}
        disabled={isDisabled}
        onPress={onPress}
        style={({ pressed }) => [
          styles.button,
          size === 'lg' && styles.buttonLg,
          size === 'sm' && styles.buttonSm,
          { backgroundColor: v.bg, borderColor: v.border },
          pressed && !isDisabled && { backgroundColor: v.pressed, transform: [{ scale: 0.985 }] },
          isDisabled && variant !== 'ghost' && { backgroundColor: colors.neutralBg, borderColor: colors.neutralBg },
        ]}
      >
        {loading ? (
          <ActivityIndicator color={variant === 'primary' ? colors.white : colors.primary} />
        ) : (
          <View style={styles.buttonInner}>
            {icon ? <Icon name={icon} size={size === 'sm' ? 16 : 19} color={fg} /> : null}
            <Text style={[styles.buttonText, size === 'sm' && { fontSize: 14 }, { color: fg }]}>{label}</Text>
          </View>
        )}
      </Pressable>
      {isDisabled && disabledReason ? <Text style={styles.disabledReason}>{disabledReason}</Text> : null}
    </View>
  );
}

const buttonVariants: Record<ButtonVariant, { bg: string; fg: string; border: string; pressed: string }> = {
  primary: { bg: colors.primary, fg: colors.white, border: colors.primary, pressed: colors.primaryPressed },
  secondary: { bg: colors.primarySoft, fg: colors.primaryInk, border: colors.primarySoft, pressed: '#CFE9E3' },
  outline: { bg: colors.surface, fg: colors.primaryInk, border: colors.borderStrong, pressed: colors.surfaceAlt },
  ghost: { bg: 'transparent', fg: colors.primary, border: 'transparent', pressed: colors.surfaceAlt },
  danger: { bg: colors.surface, fg: colors.bad, border: '#F2C4BF', pressed: colors.badBg },
};

/** 丸いアイコンボタン（ラベルは読み上げ用に必須） */
export function IconButton({
  icon,
  label,
  onPress,
  color = colors.text,
  background = colors.surface,
  size = 40,
  disabled,
  style,
}: {
  icon: IconName;
  label: string;
  onPress?: () => void;
  color?: string;
  background?: string;
  size?: number;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || !onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled || !onPress }}
      hitSlop={(MIN_TAP - size) / 2 > 0 ? (MIN_TAP - size) / 2 : 0}
      style={({ pressed }) => [
        { width: size, height: size, borderRadius: size / 2, backgroundColor: background, alignItems: 'center', justifyContent: 'center' },
        pressed && { opacity: 0.75 },
        style,
      ]}
    >
      <Icon name={icon} size={Math.round(size * 0.5)} color={disabled ? colors.disabled : color} />
    </Pressable>
  );
}

export function DemoBanner() {
  return (
    <View style={styles.demoBanner} accessibilityRole="text" accessibilityLabel="デモデータを表示中。施設は架空です">
      <Icon name="sparkles" size={14} color={colors.demo} />
      <Text style={styles.demoText}>デモデータ表示中（施設はすべて架空です）</Text>
    </View>
  );
}

export function Loading({ label = '読み込み中…' }: { label?: string }) {
  return (
    <View style={styles.center} accessibilityLiveRegion="polite">
      <ActivityIndicator color={colors.primary} size="large" />
      <Text style={[type.small, { marginTop: space.sm }]}>{label}</Text>
    </View>
  );
}

/** 空・エラー・完了などの案内（アイコン・見出し・本文・操作） */
export function EmptyState({
  icon,
  title,
  body,
  tone = 'primary',
  children,
}: {
  icon: IconName;
  title: string;
  body?: string;
  tone?: 'primary' | 'warn' | 'bad';
  children?: React.ReactNode;
}) {
  const c = tone === 'bad' ? { fg: colors.bad, bg: colors.badBg } : tone === 'warn' ? { fg: colors.warn, bg: colors.warnBg } : { fg: colors.primary, bg: colors.primarySoft };
  return (
    <View style={styles.empty} accessibilityLiveRegion="polite">
      <View style={[styles.emptyIcon, { backgroundColor: c.bg }]}>
        <Icon name={icon} size={30} color={c.fg} />
      </View>
      <Text style={[type.heading, { textAlign: 'center' }]}>{title}</Text>
      {body ? <Text style={[type.body, { textAlign: 'center', color: colors.textMuted }]}>{body}</Text> : null}
      {children ? <View style={{ alignSelf: 'stretch', gap: space.sm, marginTop: space.sm }}>{children}</View> : null}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.bg }}>
      <EmptyState icon="cloud-offline-outline" title="うまく表示できませんでした" body={message} tone="warn">
        {onRetry ? <Button label="再試行" icon="refresh" onPress={onRetry} /> : null}
      </EmptyState>
    </View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/** 見出し付きのまとまり。icon を渡すと見出しの左にアイコンを出す */
export function Section({
  title,
  icon,
  subtitle,
  children,
  right,
}: {
  title: string;
  icon?: IconName;
  subtitle?: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        {icon ? (
          <View style={styles.sectionIcon}>
            <Icon name={icon} size={16} color={colors.primary} />
          </View>
        ) : null}
        <View style={{ flex: 1 }}>
          <Text style={type.heading} accessibilityRole="header">
            {title}
          </Text>
          {subtitle ? <Text style={type.caption}>{subtitle}</Text> : null}
        </View>
        {right}
      </View>
      <View style={{ marginTop: space.md, gap: space.sm }}>{children}</View>
    </View>
  );
}

/** 画面上部の大きな見出し */
export function ScreenHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <View style={styles.screenHeader}>
      <View style={{ flex: 1 }}>
        <Text style={type.display} accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? <Text style={[type.small, { marginTop: 2 }]}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

/** 項目名と内容の1行（狭い画面では折り返す） */
export function KV({ k, v, icon }: { k: string; v: string; icon?: IconName }) {
  return (
    <View style={styles.kv}>
      <View style={styles.kvKeyWrap}>
        {icon ? <Icon name={icon} size={15} color={colors.textSubtle} /> : null}
        <Text style={styles.kvKey}>{k}</Text>
      </View>
      <Text style={styles.kvVal}>{v}</Text>
    </View>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border }, style]} />;
}

/** 設定画面などの1行（アイコン・題名・説明・右矢印） */
export function ListRow({
  icon,
  title,
  subtitle,
  onPress,
  danger,
  last,
}: {
  icon: IconName;
  title: string;
  subtitle?: string;
  onPress: () => void;
  danger?: boolean;
  last?: boolean;
}) {
  const fg = danger ? colors.bad : colors.text;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}。${subtitle}` : title}
      style={({ pressed }) => [styles.listRow, !last && styles.listRowBorder, pressed && { backgroundColor: colors.surfaceAlt }]}
    >
      <View style={[styles.listIcon, danger && { backgroundColor: colors.badBg }]}>
        <Icon name={icon} size={18} color={danger ? colors.bad : colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[type.body, { color: fg, fontWeight: '600' }]}>{title}</Text>
        {subtitle ? <Text style={type.caption}>{subtitle}</Text> : null}
      </View>
      <Icon name="chevron-forward" size={18} color={colors.textSubtle} />
    </Pressable>
  );
}

export function ToggleRow({
  label,
  value,
  onChange,
  disabled,
  note,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  note?: string;
}) {
  return (
    <Pressable
      style={[styles.toggleRow, disabled && { opacity: 0.5 }]}
      onPress={() => !disabled && onChange(!value)}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled: !!disabled }}
      accessibilityHint={note}
    >
      <View style={{ flex: 1, paddingRight: space.md, gap: 2 }}>
        <Text style={[type.body, { fontWeight: '600' }]}>{label}</Text>
        {note ? <Text style={type.caption}>{note}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ true: colors.primary, false: colors.borderStrong }}
        thumbColor={colors.white}
        importantForAccessibility="no"
        accessibilityElementsHidden
      />
    </Pressable>
  );
}

export function Chip({ label, selected, onPress, icon }: { label: string; selected: boolean; onPress: () => void; icon?: IconName }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={({ pressed }) => [styles.chip, selected && styles.chipOn, pressed && { opacity: 0.85 }]}
    >
      {selected ? <Icon name="checkmark" size={15} color={colors.white} /> : icon ? <Icon name={icon} size={15} color={colors.textMuted} /> : null}
      <Text style={[styles.chipText, selected && { color: colors.white }]}>{label}</Text>
    </Pressable>
  );
}

/** 表示専用の小さなタグ */
export function Tag({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'primary' | 'accent' }) {
  const c = tone === 'primary' ? { bg: colors.primarySoft, fg: colors.primaryInk } : tone === 'accent' ? { bg: colors.accentSoft, fg: '#8A4A12' } : { bg: colors.surfaceAlt, fg: colors.textMuted };
  return <Text style={[styles.tag, { backgroundColor: c.bg, color: c.fg }]}>{label}</Text>;
}

/** 2〜3択の切り替え */
export function Segmented<T extends string>({ options, value, onChange, style }: { options: { value: T; label: string; icon?: IconName }[]; value: T; onChange: (v: T) => void; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.segment, style]} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={[styles.segItem, on && styles.segActive]}
            accessibilityRole="tab"
            accessibilityLabel={o.label}
            accessibilityState={{ selected: on }}
          >
            {o.icon ? <Icon name={o.icon} size={16} color={on ? colors.primaryInk : colors.textMuted} /> : null}
            <Text style={[styles.segText, on && { color: colors.primaryInk }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** ラベル・入力・補足・エラーをまとめた入力欄 */
export function TextField({
  label,
  helper,
  error,
  icon,
  style,
  inputStyle,
  ...props
}: TextInputProps & { label?: string; helper?: string; error?: string | null; icon?: IconName; style?: StyleProp<ViewStyle>; inputStyle?: any }) {
  const [focused, setFocused] = React.useState(false);
  return (
    <View style={[{ gap: 6 }, style]}>
      {label ? <Text style={type.label}>{label}</Text> : null}
      <View style={[styles.field, focused && styles.fieldFocused, !!error && { borderColor: colors.bad }, props.multiline && { alignItems: 'flex-start' }]}>
        {icon ? <Icon name={icon} size={18} color={colors.textSubtle} style={props.multiline ? { marginTop: 12 } : undefined} /> : null}
        <TextInput
          placeholderTextColor={colors.textSubtle}
          {...props}
          onFocus={(e) => {
            setFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            props.onBlur?.(e);
          }}
          style={[styles.fieldInput, props.multiline && { minHeight: 132, textAlignVertical: 'top', paddingTop: 12 }, inputStyle]}
        />
      </View>
      {error ? (
        <Text style={{ color: colors.bad, fontSize: 13 }} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : helper ? (
        <Text style={type.caption}>{helper}</Text>
      ) : null}
    </View>
  );
}

/** 注意・お知らせの帯 */
export function Notice({ tone = 'warn', title, body, icon }: { tone?: 'warn' | 'bad' | 'info' | 'demo'; title: string; body?: string; icon?: IconName }) {
  const c =
    tone === 'bad'
      ? { bg: colors.badBg, fg: colors.bad, icon: 'alert-circle' as IconName }
      : tone === 'info'
        ? { bg: colors.primarySoft, fg: colors.primaryInk, icon: 'information-circle' as IconName }
        : tone === 'demo'
          ? { bg: colors.demoBg, fg: colors.demo, icon: 'sparkles' as IconName }
          : { bg: colors.warnBg, fg: colors.warn, icon: 'warning' as IconName };
  return (
    <View style={[styles.notice, { backgroundColor: c.bg }]} accessibilityLiveRegion="polite">
      <Icon name={icon ?? c.icon} size={18} color={c.fg} style={{ marginTop: 1 }} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[type.label, { color: c.fg }]}>{title}</Text>
        {body ? <Text style={[type.small, { color: colors.text }]}>{body}</Text> : null}
      </View>
    </View>
  );
}

/** 写真がない場合は施設種別のプレースホルダー（実在の店舗に見える画像は使わない） */
export function CategoryPlaceholder({ category, compact }: { category: PlaceCategory; compact?: boolean }) {
  const glyph: Record<PlaceCategory, IconName> = { cafe: 'cafe-outline', restaurant: 'restaurant-outline', commercial: 'storefront-outline', other_rest: 'leaf-outline' };
  return (
    <View
      style={[styles.placeholder, compact ? { width: 56, height: 56 } : { height: 120 }]}
      accessible
      accessibilityLabel={`写真なし（${CATEGORY_LABEL[category]}）`}
    >
      <Icon name={glyph[category]} size={compact ? 22 : 34} color={colors.primary} />
      {!compact ? <Text style={type.small}>写真なし・{CATEGORY_LABEL[category]}</Text> : null}
    </View>
  );
}

export const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    maxWidth: '100%',
  },
  badgeSm: { paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 13, fontWeight: '700', flexShrink: 1 },
  button: {
    minHeight: MIN_TAP,
    borderRadius: radius.md,
    borderWidth: 1.5,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLg: { minHeight: 54, borderRadius: radius.lg },
  buttonSm: { minHeight: 40, paddingHorizontal: space.md, borderRadius: 10 },
  buttonInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, flexShrink: 1 },
  buttonText: { fontSize: 15.5, fontWeight: '700', textAlign: 'center', flexShrink: 1 },
  disabledReason: { ...type.caption, marginTop: 4 },
  demoBanner: { backgroundColor: colors.demoBg, paddingVertical: 6, paddingHorizontal: space.lg, flexDirection: 'row', alignItems: 'center', gap: 6 },
  demoText: { color: colors.demo, fontWeight: '700', fontSize: 12.5 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl, backgroundColor: colors.bg },
  empty: { alignItems: 'center', paddingHorizontal: space.xl, paddingVertical: space.xxl, gap: space.sm },
  emptyIcon: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center', marginBottom: space.xs },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
    ...shadow.card,
  },
  section: { marginTop: space.xl },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  sectionIcon: { width: 28, height: 28, borderRadius: 9, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  screenHeader: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.sm, gap: space.md },
  kv: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.md, rowGap: 2, paddingVertical: 6 },
  kvKeyWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 104 },
  kvKey: { fontSize: 13.5, lineHeight: 22, fontWeight: '600', color: colors.textMuted },
  kvVal: { ...type.body, flex: 1, flexBasis: 180 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, paddingHorizontal: space.lg, paddingVertical: space.sm },
  listRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  listIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  toggleRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  chip: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 14, color: colors.text, fontWeight: '600' },
  tag: { fontSize: 12, fontWeight: '600', borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 3, overflow: 'hidden' },
  segment: { flexDirection: 'row', backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: 3, gap: 3 },
  segItem: { flex: 1, minHeight: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, paddingHorizontal: space.sm },
  segActive: { backgroundColor: colors.surface, ...shadow.card },
  segText: { fontSize: 14, fontWeight: '700', color: colors.textMuted },
  field: {
    minHeight: MIN_TAP + 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    backgroundColor: colors.surface,
  },
  fieldFocused: { borderColor: colors.primary },
  fieldInput: { flex: 1, minHeight: MIN_TAP, fontSize: 16, color: colors.text, paddingVertical: 0 },
  notice: { flexDirection: 'row', gap: space.sm, padding: space.md, borderRadius: radius.md },
  placeholder: {
    backgroundColor: colors.mint,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
