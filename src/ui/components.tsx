import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, View, type ViewStyle } from 'react-native';
import { CATEGORY_LABEL } from '@/domain/labels';
import type { PlaceCategory } from '@/domain/types';
import { colors, MIN_TAP, radius, space, type } from './theme';
import type { BadgeInfo, Tone } from './status';

const toneStyle: Record<Tone, { fg: string; bg: string }> = {
  ok: { fg: colors.ok, bg: colors.okBg },
  warn: { fg: colors.warn, bg: colors.warnBg },
  bad: { fg: colors.bad, bg: colors.badBg },
  neutral: { fg: colors.neutral, bg: colors.neutralBg },
  demo: { fg: colors.demo, bg: colors.demoBg },
};

const toneMark: Record<Tone, string> = { ok: '●', warn: '▲', bad: '✕', neutral: '○', demo: '◆' };

/** 色だけに頼らず、記号と文字で状態を示す */
export function Badge({ info, style }: { info: BadgeInfo; style?: ViewStyle }) {
  const t = toneStyle[info.tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }, style]} accessible accessibilityLabel={info.label}>
      <Text style={[styles.badgeText, { color: t.fg }]}>
        {toneMark[info.tone]} {info.label}
      </Text>
    </View>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  disabledReason,
  loading,
  accessibilityHint,
  style,
}: {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  disabledReason?: string;
  loading?: boolean;
  accessibilityHint?: string;
  style?: ViewStyle;
}) {
  const isDisabled = disabled || loading || !onPress;
  const v = buttonVariants[variant];
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
          { backgroundColor: v.bg, borderColor: v.border },
          pressed && !isDisabled && { opacity: 0.8 },
          isDisabled && { backgroundColor: colors.neutralBg, borderColor: colors.border },
        ]}
      >
        {loading ? (
          <ActivityIndicator color={variant === 'primary' ? '#fff' : colors.primary} />
        ) : (
          <Text style={[styles.buttonText, { color: isDisabled ? colors.disabled : v.fg }]}>{label}</Text>
        )}
      </Pressable>
      {isDisabled && disabledReason ? <Text style={styles.disabledReason}>{disabledReason}</Text> : null}
    </View>
  );
}

const buttonVariants: Record<ButtonVariant, { bg: string; fg: string; border: string }> = {
  primary: { bg: colors.primary, fg: '#FFFFFF', border: colors.primary },
  secondary: { bg: colors.surface, fg: colors.primary, border: colors.primary },
  ghost: { bg: 'transparent', fg: colors.primary, border: 'transparent' },
  danger: { bg: colors.surface, fg: colors.bad, border: colors.bad },
};

export function DemoBanner() {
  return (
    <View style={styles.demoBanner} accessibilityRole="text" accessibilityLabel="デモデータを表示中。施設は架空です">
      <Text style={styles.demoText}>◆ デモデータ表示中（施設はすべて架空です）</Text>
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

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.center} accessibilityLiveRegion="polite">
      <Text style={[type.body, { textAlign: 'center', marginBottom: space.md }]}>{message}</Text>
      {onRetry ? <Button label="再試行" onPress={onRetry} /> : null}
    </View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={type.heading} accessibilityRole="header">
        {title}
      </Text>
      <View style={{ marginTop: space.sm, gap: space.sm }}>{children}</View>
    </View>
  );
}

export function KV({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.kv}>
      <Text style={styles.kvKey}>{k}</Text>
      <Text style={styles.kvVal}>{v}</Text>
    </View>
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
      <View style={{ flex: 1, paddingRight: space.md }}>
        <Text style={type.body}>{label}</Text>
        {note ? <Text style={type.small}>{note}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ true: colors.primary, false: colors.border }}
        importantForAccessibility="no"
        accessibilityElementsHidden
      />
    </Pressable>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={[styles.chip, selected && { backgroundColor: colors.primary, borderColor: colors.primary }]}
    >
      <Text style={[styles.chipText, selected && { color: '#fff' }]}>
        {selected ? '✓ ' : ''}
        {label}
      </Text>
    </Pressable>
  );
}

/** 写真がない場合は施設種別のプレースホルダー（実在の店舗に見える画像は使わない） */
export function CategoryPlaceholder({ category, compact }: { category: PlaceCategory; compact?: boolean }) {
  const glyph: Record<PlaceCategory, string> = { cafe: '☕', restaurant: '🍽', commercial: '🏬', other_rest: '🪑' };
  return (
    <View
      style={[styles.placeholder, compact ? { width: 56, height: 56 } : { height: 120 }]}
      accessible
      accessibilityLabel={`写真なし（${CATEGORY_LABEL[category]}）`}
    >
      <Text style={{ fontSize: compact ? 22 : 36 }}>{glyph[category]}</Text>
      {!compact ? <Text style={type.small}>写真なし・{CATEGORY_LABEL[category]}</Text> : null}
    </View>
  );
}

export const styles = StyleSheet.create({
  badge: { alignSelf: 'flex-start', borderRadius: radius.sm, paddingHorizontal: space.sm, paddingVertical: 3 },
  badgeText: { fontSize: 13, fontWeight: '600' },
  button: {
    minHeight: MIN_TAP,
    borderRadius: radius.md,
    borderWidth: 1.5,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  disabledReason: { ...type.small, marginTop: 2 },
  demoBanner: { backgroundColor: colors.demoBg, paddingVertical: 6, paddingHorizontal: space.lg },
  demoText: { color: colors.demo, fontWeight: '700', fontSize: 13 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
  },
  section: { marginTop: space.xl },
  kv: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  kvKey: { ...type.label, minWidth: 96 },
  kvVal: { ...type.body, flex: 1, flexBasis: 180 },
  toggleRow: {
    minHeight: MIN_TAP,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  chip: {
    minHeight: MIN_TAP - 8,
    paddingHorizontal: space.md,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: 'center',
  },
  chipText: { fontSize: 15, color: colors.text, fontWeight: '600' },
  placeholder: {
    backgroundColor: colors.mint,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
