import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { RepoError } from '@/data/repository';
import {
  FLAG_REASON_LABEL,
  FLAG_REASONS,
  formatPostedDate,
  REVIEW_TAG_LABEL,
  UGC_STATUS_LABEL,
  type FlagReason,
  type Review,
  type UserPhoto,
} from '@/domain/ugc';
import { useApp } from '@/state/AppContext';
import { Button, Card, Chip, Section } from './components';
import { errorMessage } from './errors';
import { OtpLogin } from './OtpLogin';
import { colors, radius, space, type } from './theme';

type Target = { kind: 'review'; item: Review } | { kind: 'photo'; item: UserPhoto };

/**
 * 施設詳細の「みんなの口コミ・犬の写真」。
 * 投稿は利用者の感想で、施設の確認情報（室内同伴・冷房・犬の条件）の判定には使わない。
 */
export function UgcSection({ placeId, canPost }: { placeId: string; canPost: boolean }) {
  const { backend, isDemo } = useApp();
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [photos, setPhotos] = useState<UserPhoto[] | null>(null);
  const [error, setError] = useState<RepoError | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [viewer, setViewer] = useState<UserPhoto | null>(null);
  const [action, setAction] = useState<Target | null>(null);
  const load = useCallback(() => {
    let alive = true;
    Promise.all([backend.ugc.listReviews(placeId), backend.ugc.listPhotos(placeId)])
      .then(([r, p]) => {
        if (!alive) return;
        setReviews(r);
        setPhotos(p);
        setError(null);
      })
      .catch((e) => alive && setError(e instanceof RepoError ? e : new RepoError('network')));
    return () => {
      alive = false;
    };
  }, [backend, placeId]);
  // 投稿画面から戻ったときに読み直す
  useFocusEffect(load);
  const reload = () => {
    load();
  };

  const visibleReviews = showAll ? reviews ?? [] : (reviews ?? []).slice(0, 3);

  return (
    <>
      <Section title={`みんなの犬の写真${photos?.length ? `（${photos.length}）` : ''}`}>
        {photos === null && !error ? <Text style={type.small}>読み込み中…</Text> : null}
        {photos && photos.length === 0 ? <Text style={type.small}>まだ写真はありません。</Text> : null}
        {photos && photos.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
            {photos.map((p) => (
              <Pressable key={p.id} onPress={() => setViewer(p)} accessibilityRole="imagebutton" accessibilityLabel={`犬の写真${p.caption ? `：${p.caption}` : ''}。タップで拡大`}>
                <Image source={{ uri: p.url }} style={styles.thumb} resizeMode="cover" />
                {p.mine && p.status !== 'approved' ? <Text style={styles.statusPill}>{p.status === 'pending' ? '確認待ち' : '非表示'}</Text> : null}
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
        <Button
          label="犬の写真を投稿する"
          variant="secondary"
          onPress={canPost ? () => router.push({ pathname: '/photo/[placeId]', params: { placeId } }) : undefined}
          disabledReason={!canPost ? '最新の掲載情報を確認できるときに投稿できます' : undefined}
        />
      </Section>

      <Section title={`みんなの口コミ${reviews?.length ? `（${reviews.length}）` : ''}`}>
        <Text style={type.small}>利用者の感想です。室内同伴・冷房などの判定は運営の確認情報によるもので、口コミでは変わりません。</Text>
        {error ? (
          <View style={{ gap: space.sm }}>
            <Text style={{ color: colors.bad }}>{errorMessage(error, '口コミ・写真を読み込めませんでした。')}</Text>
            <Button label="再試行" variant="secondary" onPress={reload} />
          </View>
        ) : null}
        {reviews && reviews.length === 0 ? <Text style={type.body}>まだ口コミはありません。最初の口コミを書いてみませんか。</Text> : null}
        {visibleReviews.map((r) => (
          <ReviewItem key={r.id} review={r} onMenu={() => setAction({ kind: 'review', item: r })} />
        ))}
        {reviews && reviews.length > 3 && !showAll ? (
          <Button label={`口コミをすべて見る（${reviews.length}件）`} variant="ghost" onPress={() => setShowAll(true)} />
        ) : null}
        <Button
          label="口コミを書く"
          onPress={canPost ? () => router.push({ pathname: '/review/[placeId]', params: { placeId } }) : undefined}
          disabledReason={!canPost ? '最新の掲載情報を確認できるときに書けます' : undefined}
        />
        {isDemo ? <Text style={type.small}>デモの口コミは架空のものです。投稿した口コミ・写真はこの端末だけに保存されます。</Text> : null}
      </Section>

      <PhotoViewer
        photo={viewer}
        onClose={() => setViewer(null)}
        onMenu={(p) => {
          setViewer(null);
          setAction({ kind: 'photo', item: p });
        }}
      />
      <ActionSheet
        target={action}
        onClose={() => setAction(null)}
        onDone={() => {
          setAction(null);
          reload();
        }}
      />
    </>
  );
}

function ReviewItem({ review: r, onMenu }: { review: Review; onMenu: () => void }) {
  return (
    <Card style={{ gap: 6, padding: space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <View style={styles.avatar}>
          <Text style={{ fontSize: 16 }}>🐾</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={type.label}>
            {r.nickname}
            {r.mine ? '（あなた）' : ''}
          </Text>
          <Text style={type.small}>
            {r.publishedAt ? `${formatPostedDate(r.publishedAt)} 投稿` : '未公開'}
            {r.visitedOn ? `・${r.visitedOn.replaceAll('-', '/')} 訪問` : ''}
          </Text>
        </View>
        <Pressable onPress={onMenu} hitSlop={12} accessibilityRole="button" accessibilityLabel={r.mine ? '自分の口コミの操作（削除）' : 'この口コミを通報'} style={styles.menuBtn}>
          <Text style={type.small}>{r.mine ? '削除' : '通報'}</Text>
        </Pressable>
      </View>
      {r.mine && r.status !== 'approved' ? <Text style={styles.notice}>{UGC_STATUS_LABEL[r.status]}</Text> : null}
      {r.tags.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {r.tags.map((t) => (
            <Text key={t} style={styles.tag}>
              {REVIEW_TAG_LABEL[t]}
            </Text>
          ))}
        </View>
      ) : null}
      <Text style={type.body}>{r.body}</Text>
    </Card>
  );
}

function PhotoViewer({ photo, onClose, onMenu }: { photo: UserPhoto | null; onClose: () => void; onMenu: (p: UserPhoto) => void }) {
  return (
    <Modal visible={!!photo} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.viewerBackdrop}>
        {photo ? (
          <View style={{ gap: space.md, width: '100%', maxWidth: 560 }}>
            <Image source={{ uri: photo.url }} style={styles.viewerImg} resizeMode="contain" accessibilityLabel="犬の写真（拡大）" />
            {photo.caption ? <Text style={[type.body, { color: '#fff' }]}>{photo.caption}</Text> : null}
            <Text style={[type.small, { color: '#E5ECEA' }]}>
              {photo.publishedAt ? `${formatPostedDate(photo.publishedAt)} 投稿` : UGC_STATUS_LABEL[photo.status]}
              {photo.mine ? '・あなたの写真' : ''}
            </Text>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Button label={photo.mine ? '削除する' : '通報する'} variant="secondary" onPress={() => onMenu(photo)} style={{ flex: 1 }} />
              <Button label="閉じる" onPress={onClose} style={{ flex: 1 }} />
            </View>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

function ActionSheet({ target, onClose, onDone }: { target: Target | null; onClose: () => void; onDone: () => void }) {
  const { backend, auth } = useApp();
  const [reason, setReason] = useState<FlagReason | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const close = () => {
    setReason(null);
    setMsg(null);
    setDone(null);
    onClose();
  };
  if (!target) return null;
  const mine = target.item.mine;
  const label = target.kind === 'review' ? '口コミ' : '写真';

  const run = async () => {
    setBusy(true);
    setMsg(null);
    try {
      if (mine) {
        if (target.kind === 'review') await backend.ugc.deleteReview(target.item.id);
        else await backend.ugc.deletePhoto(target.item);
        setDone(`${label}を削除しました。`);
      } else {
        if (!reason) return;
        await backend.ugc.flag(target.kind, target.item.id, reason);
        setDone('通報を受け付けました。複数の通報があった投稿は自動で非表示になり、運営も確認します。');
      }
    } catch (e) {
      setMsg(errorMessage(e, mine ? '削除できませんでした。' : '通報できませんでした。'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={close}>
      <View style={styles.sheetBackdrop}>
        <ScrollView style={styles.sheet} contentContainerStyle={{ padding: space.lg, gap: space.md }} keyboardShouldPersistTaps="handled">
          <Text style={type.title} accessibilityRole="header">
            {mine ? `自分の${label}を削除` : `${label}を通報`}
          </Text>
          {done ? (
            <>
              <Text style={type.body} accessibilityLiveRegion="polite">
                {done}
              </Text>
              <Button
                label="閉じる"
                onPress={() => {
                  setDone(null);
                  setReason(null);
                  onDone();
                }}
              />
            </>
          ) : !auth.signedIn ? (
            <>
              <Text style={type.body}>{mine ? '削除' : '通報'}にはメールでの確認が必要です。</Text>
              <OtpLogin />
              <Button label="やめる" variant="secondary" onPress={close} />
            </>
          ) : mine ? (
            <>
              <Text style={type.body}>この{label}を削除します。元に戻せません。</Text>
              <Button label="削除する" onPress={run} loading={busy} />
              <Button label="やめる" variant="secondary" onPress={close} />
            </>
          ) : (
            <>
              <Text style={type.body}>理由を選んでください。通報した人の情報が投稿者に知らされることはありません。</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                {FLAG_REASONS.map((r) => (
                  <Chip key={r} label={FLAG_REASON_LABEL[r]} selected={reason === r} onPress={() => setReason(r)} />
                ))}
              </View>
              <Button label="通報する" onPress={run} loading={busy} disabled={!reason} disabledReason={!reason ? '理由を選んでください' : undefined} />
              <Button label="やめる" variant="secondary" onPress={close} />
            </>
          )}
          {msg ? <Text style={{ color: colors.bad }}>{msg}</Text> : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  thumb: { width: 132, height: 132, borderRadius: radius.md, backgroundColor: colors.mint },
  statusPill: { position: 'absolute', left: 6, top: 6, backgroundColor: colors.warnBg, color: colors.warn, fontSize: 11, paddingHorizontal: 6, borderRadius: 6, overflow: 'hidden' },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  menuBtn: { paddingHorizontal: space.sm, paddingVertical: 4, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border },
  tag: { fontSize: 12, color: colors.primary, backgroundColor: colors.okBg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, overflow: 'hidden' },
  notice: { ...type.small, color: colors.warn, backgroundColor: colors.warnBg, padding: 6, borderRadius: radius.sm },
  viewerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.88)', alignItems: 'center', justifyContent: 'center', padding: space.lg },
  viewerImg: { width: '100%', aspectRatio: 1, borderRadius: radius.md },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.bg, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, maxHeight: '85%' },
});
