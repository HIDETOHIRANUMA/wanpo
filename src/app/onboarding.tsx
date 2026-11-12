import { router } from 'expo-router';
import React, { useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View, type ScrollViewInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '@/state/AppContext';
import { Button, Icon, type IconName } from '@/ui/components';
import { colors, radius, shadow, space, type } from '@/ui/theme';

interface Slide {
  key: string;
  icon: IconName;
  orbit: [IconName, IconName, IconName];
  tint: string;
  title: string;
  body: string;
}

const SLIDES: Slide[] = [
  {
    key: 'find',
    icon: 'paw',
    orbit: ['snow-outline', 'cafe-outline', 'navigate-outline'],
    tint: colors.primarySoft,
    title: '暑い日も、\n犬と涼しい室内へ',
    body: '冷房のある室内で、犬と一緒に過ごせるお店や休憩所を、近い順に探せます。',
  },
  {
    key: 'trust',
    icon: 'shield-checkmark',
    orbit: ['calendar-outline', 'checkmark-done-outline', 'document-text-outline'],
    tint: '#E6F0FA',
    title: '確認済みの情報を、\nひと目で',
    body: '室内同伴と冷房は、運営が確認した記録をもとに表示します。確認日も一緒に出すので、古い情報か分かります。',
  },
  {
    key: 'fit',
    icon: 'heart',
    orbit: ['scale-outline', 'bag-handle-outline', 'ribbon-outline'],
    tint: colors.accentSoft,
    title: 'うちの犬に合うか照合',
    body: '体重や同伴方法を登録すると、お店の条件に合うかを照合します。登録は任意で、この端末にだけ保存されます。',
  },
];

export default function Onboarding() {
  const { completeOnboarding } = useApp();
  const { width } = useWindowDimensions();
  const pageWidth = Math.min(width, 560);
  const [index, setIndex] = useState(0);
  const scroller = useRef<ScrollViewInstance>(null);
  const last = index === SLIDES.length - 1;

  const goTo = (i: number) => {
    setIndex(i);
    scroller.current?.scrollTo({ x: i * pageWidth, animated: true });
  };

  const finish = async (to: '/' | '/profile') => {
    await completeOnboarding();
    router.replace(to);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <View style={styles.brand}>
          <View style={styles.brandMark}>
            <Icon name="paw" size={14} color={colors.white} />
          </View>
          <Text style={styles.brandText}>犬と涼める</Text>
        </View>
        {!last ? <Button label="スキップ" variant="ghost" size="sm" onPress={() => finish('/')} /> : null}
      </View>

      <View style={{ flex: 1, alignItems: 'center' }}>
        <ScrollView
          ref={scroller}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          style={{ width: pageWidth }}
          onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / pageWidth))}
          scrollEventThrottle={16}
        >
          {SLIDES.map((s, i) => (
            <View key={s.key} style={[styles.page, { width: pageWidth }]} accessibilityElementsHidden={i !== index} importantForAccessibility={i === index ? 'auto' : 'no-hide-descendants'}>
              <Art slide={s} />
              <Text style={[type.display, styles.title]} accessibilityRole="header">
                {s.title}
              </Text>
              <Text style={styles.body}>{s.body}</Text>
            </View>
          ))}
        </ScrollView>
      </View>

      <View style={styles.bottom}>
        <View style={styles.dots} accessible accessibilityLabel={`${SLIDES.length}ページ中${index + 1}ページ目`}>
          {SLIDES.map((s, i) => (
            <View key={s.key} style={[styles.dot, i === index && styles.dotOn]} />
          ))}
        </View>
        {last ? (
          <View style={{ gap: space.sm, alignSelf: 'stretch' }}>
            <Button label="犬の条件を登録する" icon="paw" size="lg" onPress={() => finish('/profile')} />
            <Button label="あとで登録して、さっそく探す" variant="secondary" size="lg" onPress={() => finish('/')} />
          </View>
        ) : (
          <Button label="次へ" icon="arrow-forward" size="lg" onPress={() => goTo(index + 1)} style={{ alignSelf: 'stretch' }} />
        )}
      </View>
    </SafeAreaView>
  );
}

/** 写真を使わない、図形とアイコンだけのイラスト */
function Art({ slide }: { slide: Slide }) {
  const positions = [
    { top: 8, left: 18 },
    { top: 30, right: 6 },
    { bottom: 18, left: 34 },
  ];
  return (
    <View style={styles.art} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[styles.ring, { backgroundColor: slide.tint }]} />
      <View style={styles.core}>
        <Icon name={slide.icon} size={64} color={colors.primary} />
      </View>
      {slide.orbit.map((o, i) => (
        <View key={o} style={[styles.orbit, positions[i]]}>
          <Icon name={o} size={22} color={i === 1 ? colors.accent : colors.primary} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, minHeight: 52 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandMark: { width: 26, height: 26, borderRadius: 8, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  brandText: { fontSize: 16, fontWeight: '800', color: colors.text, letterSpacing: 0.4 },
  page: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl, gap: space.md },
  title: { textAlign: 'center', marginTop: space.lg },
  body: { ...type.body, fontSize: 16, lineHeight: 26, color: colors.textMuted, textAlign: 'center', maxWidth: 420 },
  art: { width: 260, height: 240, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 230, height: 230, borderRadius: 115 },
  core: { width: 148, height: 148, borderRadius: 74, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', ...shadow.raised },
  orbit: { position: 'absolute', width: 52, height: 52, borderRadius: radius.lg, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', ...shadow.card },
  bottom: { paddingHorizontal: space.lg, paddingBottom: space.lg, paddingTop: space.md, gap: space.lg, alignItems: 'center', width: '100%', maxWidth: 560, alignSelf: 'center' },
  dots: { flexDirection: 'row', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.borderStrong },
  dotOn: { width: 24, backgroundColor: colors.primary },
});
