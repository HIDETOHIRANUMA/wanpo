import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Linking, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { Badge, Button, Card, CategoryPlaceholder, DemoBanner, ErrorState, KV, Loading, Section } from '@/ui/components';
import { errorMessage } from '@/ui/errors';
import { availabilityBadge, baseBadge, fitBadge, freshnessText } from '@/ui/status';
import { carryText, certificateText, eligibilityText, feeText, orderText, reservationText, waterText, weightText, zoneSummary } from '@/ui/summaries';
import { colors, space, type } from '@/ui/theme';

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
  const base = judgeBase(place);
  const fit = judgeDogFit(place, profile);
  const settings = { staleAfterDays: staleDays };
  const freshness = keyFreshness(place.verifications, now, settings);
  const availability = availabilityAt(place, now);
  const z = place.zone;
  const u = place.usage;

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

  return (
    <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 48 }}>
      {src.kind === 'cached' ? (
        <View style={styles.cache} accessibilityLiveRegion="polite">
          <Text style={type.label}>通信できないため、保存時の情報を表示しています</Text>
          <Text style={type.small}>取得日時：{formatJstDateTime(src.fetchedAt)}（最新ではない可能性があります）</Text>
        </View>
      ) : null}
      {src.kind === 'unavailable' ? (
        <View style={[styles.cache, { backgroundColor: colors.badBg }]}>
          <Text style={type.label}>現在の掲載情報を確認できません</Text>
          <Text style={type.small}>以下は保存時の情報です。電話・経路は使えません。</Text>
        </View>
      ) : null}

      {/* 1. 名称・写真 */}
      <Text style={type.title} accessibilityRole="header">
        {place.name}
      </Text>
      <Text style={type.small}>
        {CATEGORY_LABEL[place.category]} ・{OPERATING_LABEL[place.operatingStatus]}
      </Text>
      <View style={{ marginTop: space.md }}>
        {place.photoUrl ? (
          <View>
            <Image source={{ uri: place.photoUrl }} style={styles.photo} accessibilityLabel={`${place.name}の写真`} />
            {place.photoCredit ? <Text style={type.small}>写真：{place.photoCredit}</Text> : null}
          </View>
        ) : (
          <CategoryPlaceholder category={place.category} />
        )}
      </View>

      {/* 2. 犬と過ごせる区画 */}
      <Section title="犬と過ごせる区画">
        <Card style={{ gap: space.sm }}>
          <Text style={type.heading}>{zoneSummary(z)}</Text>
          <Badge info={baseBadge(base)} />
          <KV k="室内同伴" v={base.indoor === 'confirmed_yes' ? '可（確認記録あり）' : base.indoor === 'no' ? (z.scope === 'terrace' ? '不可（テラスのみ）' : '不可') : '未確認'} />
          <KV k="冷房" v={base.air === 'confirmed_yes' ? 'あり（確認記録あり）' : base.air === 'no' ? 'なし' : '未確認'} />
          <Text style={type.small}>この区画についての情報です。施設内の別の場所の冷房は含みません。</Text>
          {z.scope === 'indoor_partial' || z.scope === 'private_room' ? (
            <Text style={type.small}>※ {ZONE_SCOPE_LABEL[z.scope]}。他の席では犬と過ごせません。</Text>
          ) : null}
        </Card>
      </Section>

      {/* 3. 登録した犬の条件との一致 */}
      <Section title="うちの犬の条件との照合">
        <Card style={{ gap: space.sm }}>
          <Badge info={fitBadge(fit.result)} />
          {fit.reasons.map((r, i) => (
            <Text key={i} style={type.body}>
              {r.result === 'match' ? '● ' : r.result === 'mismatch' ? '✕ ' : '▲ '}
              {r.message}
            </Text>
          ))}
          <Text style={type.small}>
            登録内容と掲載情報の照合結果です。当日の入店・冷房の稼働・空席を保証するものではありません。
          </Text>
          {!profile ? <Button label="犬の条件を登録する" variant="secondary" onPress={() => router.push('/profile')} /> : null}
        </Card>
      </Section>

      {/* 4. 犬同伴の条件 */}
      <Section title="犬同伴の条件">
        <KV k="体重制限" v={weightText(z)} />
        <KV k="同伴方法" v={`${carryText(z)}${z.carry.text ? `（${z.carry.text}）` : ''}`} />
        <KV k="証明書" v={certificateText(z)} />
        {z.extraRequirements.map((x, i) => (
          <KV key={i} k={x.effect === 'needs_check' ? '追加条件（要確認）' : '注意事項'} v={x.text} />
        ))}
      </Section>

      {/* 5. 利用条件 */}
      <Section title="注文・予約・料金・利用資格">
        <KV k="注文" v={orderText(u)} />
        <KV k="予約" v={reservationText(u)} />
        <KV k="料金" v={feeText(u)} />
        <KV k="利用資格" v={eligibilityText(u)} />
        <KV k="犬用の水" v={waterText(u)} />
      </Section>

      {/* 6. 営業時間 */}
      <Section title="営業時間・犬同伴可能時間">
        <Badge info={availabilityBadge(availability)} />
        <Text style={type.small}>登録された時間による表示です。実際の営業・空席の状況ではありません。</Text>
        <HoursTable label="営業時間" schedule={place.businessHours} now={now} />
        {place.dogHours.mode === 'same_as_business' ? (
          <KV k="犬同伴可能時間" v="営業時間と同じ" />
        ) : place.dogHours.mode === 'unknown' ? (
          <KV k="犬同伴可能時間" v="未確認" />
        ) : (
          <HoursTable label="犬同伴可能時間" schedule={place.dogHours.schedule} now={now} />
        )}
        {[...place.businessHours.exceptions].sort((a, b) => a.date.localeCompare(b.date)).map((e) => (
          <KV key={e.date} k={`${e.date.replaceAll('-', '/')}`} v={`${e.closed ? '休業' : formatPeriods(e.periods)}${e.note ? `（${e.note}）` : ''}`} />
        ))}
      </Section>

      {/* 7. 住所・確認情報 */}
      <Section title="住所・確認情報">
        <KV k="住所" v={place.address} />
        <Badge info={freshnessText(freshness)} />
        <Text style={type.small}>
          確認日は室内同伴・冷房・犬の条件のうち最も古い確認です。{staleDays}日を超えたものは再確認をおすすめします（運用上の目安です）。
        </Text>
        {KEY_VERIFICATION_FIELDS.concat(['usage_conditions', 'hours']).map((f) => {
          const v = latestVerification(place.verifications, f);
          return (
            <Card key={f} style={{ gap: 2, padding: space.md }}>
              <Text style={type.label}>{VERIFICATION_FIELD_LABEL[f]}</Text>
              {v ? (
                <>
                  <Text style={type.body}>
                    {formatJstDate(v.verifiedAt)}・{VERIFICATION_METHOD_LABEL[v.method]}
                    {isStale(v, now, settings) ? '・再確認をおすすめ' : ''}
                  </Text>
                  {v.evidenceNote ? <Text style={type.small}>根拠：{v.evidenceNote}</Text> : null}
                  {v.evidenceUrl && validateHttpsUrl(v.evidenceUrl) && !isDemo ? (
                    <Button label="根拠のページを開く" variant="ghost" onPress={() => open(v.evidenceUrl!)} />
                  ) : null}
                </>
              ) : (
                <Text style={type.body}>未確認</Text>
              )}
            </Card>
          );
        })}
        {place.description ? <Text style={type.body}>{place.description}</Text> : null}
      </Section>

      {/* 8. 操作 */}
      <Section title="行く前に">
        <Button
          label="電話で確認"
          onPress={actions.telUrl ? () => open(actions.telUrl!) : undefined}
          disabledReason={contactBlocked ?? (!actions.telUrl ? '電話番号は掲載されていません' : undefined)}
        />
        <Button
          label="公式サイト"
          variant="secondary"
          onPress={actions.officialUrl ? () => open(actions.officialUrl!) : undefined}
          disabledReason={contactBlocked ?? (!actions.officialUrl ? '公式サイトは掲載されていません' : undefined)}
        />
        <Button
          label="経路を見る（地図アプリ）"
          variant="secondary"
          onPress={actions.directionsUrl ? () => open(actions.directionsUrl!) : undefined}
          disabledReason={contactBlocked ?? undefined}
          accessibilityHint="端末の地図アプリで目的地を開きます。現在地は送信しません"
        />
        <Button label={saved ? '保存済み（タップで解除）' : '保存する'} variant={saved ? 'secondary' : 'primary'} onPress={onSave} loading={saving} />
        <Button
          label="情報の修正を知らせる"
          variant="ghost"
          onPress={src.kind === 'live' ? () => router.push({ pathname: '/report/[placeId]', params: { placeId: place.id, type: 'correction' } }) : undefined}
          disabledReason={src.kind !== 'live' ? '最新の掲載情報を確認できるときに送れます' : undefined}
        />
        <Button
          label="犬と過ごせたか回答する（運営の確認用）"
          variant="ghost"
          onPress={src.kind === 'live' ? () => router.push({ pathname: '/report/[placeId]', params: { placeId: place.id, type: 'dog_ok_vote' } }) : undefined}
          disabledReason={src.kind !== 'live' ? '最新の掲載情報を確認できるときに回答できます' : undefined}
        />
        <Text style={type.small}>報告・回答は運営が確認してから掲載に反映するかを判断します。公開されたり、自動で反映されたりはしません。</Text>
      </Section>
    </ScrollView>
  );
}

function HoursTable({ label, schedule, now }: { label: string; schedule: Schedule; now: Date }) {
  const today = useMemo(() => toJst(now), [now]);
  if (schedule.weekly.status !== 'confirmed') return <KV k={label} v="未確認" />;
  return (
    <View style={{ gap: 2 }}>
      <Text style={type.label}>{label}</Text>
      {([1, 2, 3, 4, 5, 6, 0] as Weekday[]).map((d) => (
        <Text key={d} style={[type.body, d === today.weekday && { fontWeight: '700' }]}>
          {WEEKDAY_LABEL[d]}　{formatPeriods(schedule.weekly.byWeekday[d])}
          {d === today.weekday ? `（今日${periodsForDate(schedule, today.date, today.weekday) !== schedule.weekly.byWeekday[d] ? '・日付別の変更あり' : ''}）` : ''}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  cache: { backgroundColor: colors.warnBg, padding: space.md, borderRadius: 8, marginBottom: space.md, gap: 2 },
  photo: { width: '100%', height: 180, borderRadius: 10, backgroundColor: colors.mint },
});
