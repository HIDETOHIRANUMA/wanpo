import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RepoError } from '@/data/repository';
import { validateHttpsUrl } from '@/domain/contact';
import { contactActions } from '@/ui/contactPolicy';
import { availabilityAt, formatPeriods, periodsForDate, toJst, WEEKDAY_LABEL } from '@/domain/hours';
import { judgeBase, judgeDogFit } from '@/domain/judge';
import { CATEGORY_LABEL, OPERATING_LABEL, VERIFICATION_FIELD_LABEL, VERIFICATION_METHOD_LABEL, ZONE_SCOPE_LABEL } from '@/domain/labels';
import type { Place, Schedule, Weekday } from '@/domain/types';
import { isStale, keyFreshness, latestVerification, formatJstDate, formatJstDateTime } from '@/domain/verification';
import { KEY_VERIFICATION_FIELDS } from '@/domain/types';
import { useApp } from '@/state/AppContext';
import { Badge, Button, Card, DemoBanner, ErrorState, Icon, KV, ListRow, Loading, Notice, Section, Tag, type IconName } from '@/ui/components';
import { MediaGallery, PlaceHero } from '@/ui/PlaceVisual';
import { UgcSection } from '@/ui/UgcSection';
import { errorMessage } from '@/ui/errors';
import { availabilityBadge, baseBadge, fitBadge, freshnessText } from '@/ui/status';
import { breedText, carryText, certificateText, dogMenuText, dogSeatsText, eligibilityText, feeText, floorText, maxDogsText, orderText, reservationText, waterText, weightText, zoneSummary } from '@/ui/summaries';
import { DayTimeline } from '@/ui/DayTimeline';
import { useHeat } from '@/ui/useHeat';
import { colors, radius, shadow, space, type } from '@/ui/theme';

type Source =
  | { kind: 'live'; place: Place }
  | { kind: 'cached'; place: Place; fetchedAt: string } // 通信できず保存時の情報を表示
  | { kind: 'unavailable'; place: Place | null; fetchedAt?: string }; // 取得成功・掲載なし

export default function PlaceDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { backend, saved, isDemo, profile, toggleSave, isSaved, config } = useApp();
  const [src, setSrc] = useState<Source | null>(null);
  const [error, setError] = useState<RepoError | null>(null);
  const [saving, setSaving] = useState(false);
  const [now] = useState(() => new Date());

  const [reloadKey, setReloadKey] = useState(0);
  const retry = () => {
    setError(null);
    setSrc(null);
    setReloadKey((k) => k + 1);
  };

  // 保存一覧の変化では再取得しない
  const savedRef = useRef(saved);
  useEffect(() => {
    savedRef.current = saved;
  }, [saved]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const entry = savedRef.current.find((e) => e.placeId === id);
      try {
        const p = await backend.places.getPlace(String(id));
        if (!alive) return;
        if (p) setSrc({ kind: 'live', place: p });
        else setSrc({ kind: 'unavailable', place: entry?.snapshot ?? null, fetchedAt: entry?.fetchedAt });
      } catch (e) {
        if (!alive) return;
        // 通信エラー：保存済みならキャッシュを表示（掲載終了とは区別）
        if (entry) setSrc({ kind: 'cached', place: entry.snapshot, fetchedAt: entry.fetchedAt });
        else setError(e instanceof RepoError ? e : new RepoError('network'));
      }
    })();
    return () => {
      alive = false;
    };
  }, [backend, id, reloadKey]);

  if (error) return <ErrorState message={errorMessage(error, '施設情報を読み込めませんでした。')} onRetry={retry} />;
  if (!src) return <Loading />;
  if (!src.place)
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <ErrorState message="現在の掲載情報を確認できません。掲載が終了したか、内容の確認中の可能性があります。" />
      </View>
    );

  const place = src.place;
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: '施設の詳細' }} />
      {isDemo ? <DemoBanner /> : null}
      <Detail
        place={place}
        src={src}
        isDemo={isDemo}
        now={now}
        profile={profile}
        staleDays={config.settings.staleAfterDays}
        saved={isSaved(place.id)}
        saving={saving}
        onSave={async () => {
          setSaving(true);
          try {
            await toggleSave(place);
          } finally {
            setSaving(false);
          }
        }}
      />
    </View>
  );
}

function Detail({
  place,
  src,
  isDemo,
  now,
  profile,
  staleDays,
  saved,
  saving,
  onSave,
}: {
  place: Place;
  src: Source;
  isDemo: boolean;
  now: Date;
  profile: ReturnType<typeof useApp>['profile'];
  staleDays: number;
  saved: boolean;
  saving: boolean;
  onSave: () => void;
}) {
  const insets = useSafeAreaInsets();
  const base = judgeBase(place);
  const fit = judgeDogFit(place, profile);
  const settings = { staleAfterDays: staleDays };
  const freshness = keyFreshness(place.verifications, now, settings);
  const availability = availabilityAt(place, now);
  const z = place.zone;
  const u = place.usage;
  const heat = useHeat(place);

  // 外部連絡・経路：デモ、掲載確認不可のときは無効
  const platform = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';
  const actions = contactActions(place, { isDemoMode: isDemo, source: src.kind, platform });
  const contactBlocked = actions.blockedReason;

  const open = async (target: string) => {
    try {
      await Linking.openURL(target);
    } catch {
      // 開けない場合は何もしない（端末に対応アプリがない）
    }
  };

  const indoorTile: TileInfo =
    base.indoor === 'confirmed_yes'
      ? { tone: 'ok', value: '可', note: '確認記録あり' }
      : base.indoor === 'no'
        ? { tone: 'bad', value: '不可', note: z.scope === 'terrace' ? 'テラスのみ' : '室内に入れない' }
        : { tone: 'warn', value: '未確認', note: '確認記録なし' };
  const airTile: TileInfo =
    base.air === 'confirmed_yes'
      ? { tone: 'ok', value: 'あり', note: '確認記録あり' }
      : base.air === 'no'
        ? { tone: 'bad', value: 'なし', note: '犬と過ごせる区画' }
        : { tone: 'warn', value: '未確認', note: '確認記録なし' };
  const openTile: TileInfo =
    availability === 'open'
      ? { tone: 'ok', value: '営業中', note: '営業時間上' }
      : availability === 'closed'
        ? { tone: 'neutral', value: '時間外', note: '営業時間上' }
        : { tone: 'warn', value: '未確認', note: '営業時間' };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 132 + insets.bottom }}>
        {src.kind === 'cached' ? (
          <View style={styles.noticeWrap}>
            <Notice tone="warn" title="通信できないため、保存時の情報を表示しています" body={`取得日時：${formatJstDateTime(src.fetchedAt)}（最新ではない可能性があります）`} icon="cloud-offline-outline" />
          </View>
        ) : null}
        {src.kind === 'unavailable' ? (
          <View style={styles.noticeWrap}>
            <Notice tone="bad" title="現在の掲載情報を確認できません" body="以下は保存時の情報です。電話・経路は使えません。" />
          </View>
        ) : null}

        <PlaceHero place={place} height={250} rounded={false} />

        <View style={styles.content}>
          {/* 1. 名称 */}
          <Card style={styles.titleCard}>
            <Text style={type.title} accessibilityRole="header">
              {place.name}
            </Text>
            <View style={styles.metaRow}>
              <MetaItem icon="storefront-outline" text={CATEGORY_LABEL[place.category]} />
              {place.areaName ? <MetaItem icon="location-outline" text={place.areaName} /> : null}
              <MetaItem icon="information-circle-outline" text={OPERATING_LABEL[place.operatingStatus]} />
            </View>
            {place.atmosphereTags.length ? (
              <View style={styles.tags} accessibilityLabel={`雰囲気：${place.atmosphereTags.join('、')}`}>
                {place.atmosphereTags.map((t) => (
                  <Tag key={t} label={t} tone="primary" />
                ))}
              </View>
            ) : null}
          </Card>

          {/* 2. ひと目で分かる確認状況 */}
          <View style={styles.tiles}>
            <Tile icon="paw" label="室内同伴" info={indoorTile} />
            <Tile icon="snow" label="冷房" info={airTile} />
            <Tile icon="time" label="いま" info={openTile} />
          </View>
          <View style={{ gap: 6, marginTop: space.md }}>
            <Badge info={baseBadge(base)} />
            <Badge info={freshnessText(freshness)} />
          </View>

          {/* 今日のタイムライン（営業・犬と過ごせる時間・暑さ指数） */}
          <Section title="今日のタイムライン" icon="today-outline" subtitle="何時に行けば入れて、暑い時間をここで過ごせるか">
            <Card>
              <DayTimeline place={place} now={now} forecast={heat.status === 'ok' ? heat.forecast : null} />
            </Card>
          </Section>

          {place.media.length > 1 ? (
            <Section title="お店の写真" icon="images-outline">
              <MediaGallery media={place.media} />
            </Section>
          ) : null}

          {/* 3. 犬と過ごせる区画 */}
          <Section title="犬と過ごせる区画" icon="paw-outline">
            <Card style={{ gap: space.xs }}>
              <Text style={type.heading}>{zoneSummary(z)}</Text>
              <KV k="室内同伴" icon="enter-outline" v={base.indoor === 'confirmed_yes' ? '可（確認記録あり）' : base.indoor === 'no' ? (z.scope === 'terrace' ? '不可（テラスのみ）' : '不可') : '未確認'} />
              <KV k="冷房" icon="snow-outline" v={base.air === 'confirmed_yes' ? 'あり（確認記録あり）' : base.air === 'no' ? 'なし' : '未確認'} />
              <Text style={type.caption}>この区画についての情報です。施設内の別の場所の冷房は含みません。</Text>
              {z.scope === 'indoor_partial' || z.scope === 'private_room' ? (
                <Text style={type.caption}>※ {ZONE_SCOPE_LABEL[z.scope]}。他の席では犬と過ごせません。</Text>
              ) : null}
            </Card>
          </Section>

          {/* 4. 登録した犬の条件との一致 */}
          <Section title="うちの犬の条件との照合" icon="heart-outline">
            <Card style={{ gap: space.sm }}>
              <Badge info={fitBadge(fit.result)} />
              {fit.reasons.map((r, i) => (
                <View key={i} style={styles.reason}>
                  <Icon
                    name={r.result === 'match' ? 'checkmark-circle' : r.result === 'mismatch' ? 'close-circle' : 'alert-circle'}
                    size={18}
                    color={r.result === 'match' ? colors.ok : r.result === 'mismatch' ? colors.bad : colors.warn}
                    style={{ marginTop: 2 }}
                  />
                  <Text style={[type.body, { flex: 1 }]}>{r.message}</Text>
                </View>
              ))}
              <Text style={type.caption}>登録内容と掲載情報の照合結果です。当日の入店・冷房の稼働・空席を保証するものではありません。</Text>
              {!profile ? <Button label="犬の条件を登録する" icon="paw-outline" variant="secondary" onPress={() => router.push('/profile')} /> : null}
              {profile ? <Button label="入店時に「うちの子カード」を見せる" icon="id-card-outline" variant="secondary" onPress={() => router.push('/dog-card')} /> : null}
            </Card>
          </Section>

          {/* 5. 犬同伴の条件 */}
          <Section title="犬同伴の条件" icon="shield-checkmark-outline">
            <Card style={{ paddingVertical: space.sm }}>
              <KV k="体重制限" icon="scale-outline" v={weightText(z)} />
              <KV k="同伴方法" icon="bag-handle-outline" v={`${carryText(z)}${z.carry.text ? `（${z.carry.text}）` : ''}`} />
              <KV k="証明書" icon="ribbon-outline" v={certificateText(z)} />
              <KV k="犬種" icon="paw-outline" v={breedText(z)} />
              <KV k="頭数" icon="people-outline" v={maxDogsText(z)} />
              {z.extraRequirements.map((x, i) => (
                <KV key={i} k={x.effect === 'needs_check' ? '追加条件（要確認）' : '注意事項'} icon="alert-circle-outline" v={x.text} />
              ))}
            </Card>
          </Section>

          {/* 6. 利用条件 */}
          <Section title="注文・予約・料金・利用資格" icon="receipt-outline">
            <Card style={{ paddingVertical: space.sm }}>
              <KV k="注文" icon="cafe-outline" v={orderText(u)} />
              <KV k="予約" icon="calendar-outline" v={reservationText(u)} />
              <KV k="料金" icon="pricetag-outline" v={feeText(u)} />
              <KV k="利用資格" icon="person-outline" v={eligibilityText(u)} />
              <KV k="犬用の水" icon="water-outline" v={waterText(u)} />
            </Card>
          </Section>

          {/* 犬連れの過ごしやすさ */}
          <Section title="犬連れの過ごしやすさ" icon="happy-outline">
            <Card style={{ paddingVertical: space.sm }}>
              <KV k="床" icon="footsteps-outline" v={floorText(z)} />
              <KV k="犬用メニュー" icon="restaurant-outline" v={dogMenuText(z)} />
              <KV k="犬と座れる席" icon="grid-outline" v={dogSeatsText(z)} />
              {z.floor === 'slippery' || z.floor === 'mixed' ? <Text style={type.caption}>滑りやすい床はシニア犬や小型犬の足腰に負担がかかります。マットや抱っこで対応しましょう。</Text> : null}
            </Card>
          </Section>

          {/* 7. 営業時間 */}
          <Section title="営業時間・犬同伴可能時間" icon="time-outline">
            <Card style={{ gap: space.md }}>
              <Badge info={availabilityBadge(availability)} />
              <HoursTable label="営業時間" schedule={place.businessHours} now={now} />
              {place.dogHours.mode === 'same_as_business' ? (
                <KV k="犬同伴可能時間" v="営業時間と同じ" />
              ) : place.dogHours.mode === 'unknown' ? (
                <KV k="犬同伴可能時間" v="未確認" />
              ) : (
                <HoursTable label="犬同伴可能時間" schedule={place.dogHours.schedule} now={now} />
              )}
              {[...place.businessHours.exceptions].sort((a, b) => a.date.localeCompare(b.date)).map((e) => (
                <KV key={e.date} k={`${e.date.replaceAll('-', '/')}`} icon="calendar-number-outline" v={`${e.closed ? '休業' : formatPeriods(e.periods)}${e.note ? `（${e.note}）` : ''}`} />
              ))}
              <Text style={type.caption}>登録された時間による表示です。実際の営業・空席の状況ではありません。</Text>
            </Card>
          </Section>

          {/* 8. 住所・確認情報 */}
          <Section title="住所・確認情報" icon="document-text-outline">
            <Card style={{ gap: space.sm }}>
              <KV k="住所" icon="location-outline" v={place.address} />
              {place.description ? <Text style={type.body}>{place.description}</Text> : null}
              <Text style={type.caption}>
                確認日は室内同伴・冷房・犬の条件のうち最も古い確認です。{staleDays}日を超えたものは再確認をおすすめします（運用上の目安です）。
              </Text>
              <View style={{ gap: 0 }}>
                {KEY_VERIFICATION_FIELDS.concat(['usage_conditions', 'hours']).map((f, i, arr) => {
                  const v = latestVerification(place.verifications, f);
                  return (
                    <View key={f} style={[styles.verRow, i < arr.length - 1 && styles.verBorder]}>
                      <Icon name={v ? (isStale(v, now, settings) ? 'alert-circle' : 'checkmark-circle') : 'ellipse-outline'} size={18} color={v ? (isStale(v, now, settings) ? colors.warn : colors.ok) : colors.textSubtle} style={{ marginTop: 2 }} />
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={type.label}>{VERIFICATION_FIELD_LABEL[f]}</Text>
                        {v ? (
                          <>
                            <Text style={type.small}>
                              {formatJstDate(v.verifiedAt)}・{VERIFICATION_METHOD_LABEL[v.method]}
                              {isStale(v, now, settings) ? '・再確認をおすすめ' : ''}
                            </Text>
                            {v.evidenceNote ? <Text style={type.caption}>根拠：{v.evidenceNote}</Text> : null}
                            {v.evidenceUrl && validateHttpsUrl(v.evidenceUrl) && !isDemo ? (
                              <Button label="根拠のページを開く" icon="open-outline" variant="ghost" size="sm" onPress={() => open(v.evidenceUrl!)} style={{ alignSelf: 'flex-start' }} />
                            ) : null}
                          </>
                        ) : (
                          <Text style={type.small}>未確認</Text>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            </Card>
          </Section>

          {/* 9. 行く前に */}
          <Section title="行く前に" icon="information-circle-outline">
            <Button
              label="公式サイト"
              icon="globe-outline"
              variant="outline"
              onPress={actions.officialUrl ? () => open(actions.officialUrl!) : undefined}
              disabledReason={contactBlocked ?? (!actions.officialUrl ? '公式サイトは掲載されていません' : undefined)}
            />
            {place.reservationUrl ? (
              <Text style={type.caption}>空席・予約の可否は予約ページでご確認ください。犬連れであることを予約時に伝えるのがおすすめです。</Text>
            ) : null}
            <Card style={{ padding: 0, overflow: 'hidden', marginTop: space.xs }}>
              <ListRow
                icon="create-outline"
                title="情報の修正を知らせる"
                subtitle={src.kind !== 'live' ? '最新の掲載情報を確認できるときに送れます' : '営業時間や犬の条件の変更など'}
                onPress={src.kind === 'live' ? () => router.push({ pathname: '/report/[placeId]', params: { placeId: place.id, type: 'correction' } }) : () => undefined}
              />
              <ListRow
                icon="chatbox-ellipses-outline"
                title="犬と過ごせたか回答する"
                subtitle={src.kind !== 'live' ? '最新の掲載情報を確認できるときに回答できます' : '運営の確認用アンケート'}
                onPress={src.kind === 'live' ? () => router.push({ pathname: '/report/[placeId]', params: { placeId: place.id, type: 'dog_ok_vote' } }) : () => undefined}
                last
              />
            </Card>
            <Text style={type.caption}>報告・回答は運営が確認してから掲載に反映するかを判断します。公開されたり、自動で反映されたりはしません。</Text>
          </Section>

          {/* 10. 利用者の投稿 */}
          <UgcSection placeId={place.id} canPost={src.kind === 'live'} />
        </View>
      </ScrollView>

      {/* 下部の操作バー：保存・電話・経路・予約 */}
      <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, space.md) }]}>
        {contactBlocked ? (
          <View style={styles.barNote}>
            <Icon name="information-circle-outline" size={14} color={colors.textMuted} />
            <Text style={[type.caption, { flex: 1 }]}>{contactBlocked}</Text>
          </View>
        ) : null}
        <View style={styles.barRow}>
          <Pressable
            onPress={onSave}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel={saved ? '保存済み。タップで保存を解除' : '保存する'}
            accessibilityState={{ selected: saved, busy: saving }}
            style={({ pressed }) => [styles.saveBtn, saved && { borderColor: '#F5C2C4', backgroundColor: '#FFF1F1' }, pressed && { opacity: 0.8 }]}
          >
            <Icon name={saved ? 'heart' : 'heart-outline'} size={22} color={saved ? colors.heart : colors.text} />
            <Text style={[styles.saveText, saved && { color: colors.heart }]}>{saved ? '保存済み' : '保存'}</Text>
          </Pressable>
          <Button
            label="電話"
            icon="call-outline"
            variant="outline"
            onPress={actions.telUrl ? () => open(actions.telUrl!) : undefined}
            accessibilityHint={!actions.telUrl && !contactBlocked ? '電話番号は掲載されていません' : undefined}
            style={{ flex: 1 }}
          />
          <Button
            label="経路"
            icon="navigate-outline"
            variant={place.reservationUrl ? 'outline' : 'primary'}
            onPress={actions.directionsUrl ? () => open(actions.directionsUrl!) : undefined}
            accessibilityHint="端末の地図アプリで目的地を開きます。現在地は送信しません"
            style={{ flex: 1 }}
          />
          {place.reservationUrl ? (
            <Button
              label="予約"
              icon="calendar-outline"
              onPress={actions.reservationUrl ? () => open(actions.reservationUrl!) : undefined}
              accessibilityHint="お店の予約ページをブラウザで開きます"
              style={{ flex: 1.2 }}
            />
          ) : null}
        </View>
      </View>
    </View>
  );
}

type TileInfo = { tone: 'ok' | 'warn' | 'bad' | 'neutral'; value: string; note: string };

function Tile({ icon, label, info }: { icon: IconName; label: string; info: TileInfo }) {
  const c =
    info.tone === 'ok'
      ? { fg: colors.ok, bg: colors.okBg }
      : info.tone === 'bad'
        ? { fg: colors.bad, bg: colors.badBg }
        : info.tone === 'warn'
          ? { fg: colors.warn, bg: colors.warnBg }
          : { fg: colors.neutral, bg: colors.neutralBg };
  return (
    <View style={styles.tile} accessible accessibilityLabel={`${label}：${info.value}（${info.note}）`}>
      <View style={[styles.tileIcon, { backgroundColor: c.bg }]}>
        <Icon name={icon} size={18} color={c.fg} />
      </View>
      <Text style={type.overline}>{label}</Text>
      <Text style={[styles.tileValue, { color: c.fg }]}>{info.value}</Text>
      <Text style={type.caption} numberOfLines={1}>
        {info.note}
      </Text>
    </View>
  );
}

function MetaItem({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Icon name={icon} size={14} color={colors.textMuted} />
      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted }}>{text}</Text>
    </View>
  );
}

function HoursTable({ label, schedule, now }: { label: string; schedule: Schedule; now: Date }) {
  const today = useMemo(() => toJst(now), [now]);
  if (schedule.weekly.status !== 'confirmed') return <KV k={label} v="未確認" />;
  return (
    <View style={{ gap: 2 }}>
      <Text style={[type.label, { marginBottom: 4 }]}>{label}</Text>
      {([1, 2, 3, 4, 5, 6, 0] as Weekday[]).map((d) => {
        const isToday = d === today.weekday;
        const changed = isToday && periodsForDate(schedule, today.date, today.weekday) !== schedule.weekly.byWeekday[d];
        return (
          <View key={d} style={[styles.hourRow, isToday && styles.hourToday]}>
            <Text style={[styles.hourDay, isToday && { color: colors.primaryInk }]}>{WEEKDAY_LABEL[d]}</Text>
            <Text style={[type.body, { flex: 1 }, isToday && { fontWeight: '700' }]}>{formatPeriods(schedule.weekly.byWeekday[d])}</Text>
            {isToday ? <Text style={styles.todayPill}>{changed ? '今日・日付別の変更あり' : '今日'}</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  noticeWrap: { padding: space.lg, paddingBottom: space.md },
  content: { paddingHorizontal: space.lg },
  titleCard: { marginTop: -36, gap: space.sm },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.md, rowGap: 4 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tiles: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  tile: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: space.md, gap: 2, ...shadow.card },
  tileIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  tileValue: { fontSize: 18, lineHeight: 24, fontWeight: '800' },
  reason: { flexDirection: 'row', gap: space.sm },
  verRow: { flexDirection: 'row', gap: space.sm, paddingVertical: space.sm },
  verBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  hourRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 5, paddingHorizontal: space.sm, borderRadius: radius.sm },
  hourToday: { backgroundColor: colors.primarySoft },
  hourDay: { width: 22, fontSize: 14, fontWeight: '700', color: colors.textMuted },
  todayPill: { fontSize: 11, fontWeight: '800', color: colors.white, backgroundColor: colors.primary, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, overflow: 'hidden' },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.surface, paddingTop: space.sm, paddingHorizontal: space.lg, gap: 6, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border, ...shadow.bar },
  barNote: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  barRow: { flexDirection: 'row', gap: space.sm, alignItems: 'stretch' },
  saveBtn: { width: 64, minHeight: 48, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center', gap: 0 },
  saveText: { fontSize: 10.5, fontWeight: '700', color: colors.text },
});
