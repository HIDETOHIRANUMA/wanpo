import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { RepoError } from '@/data/repository';
import {
  FLAG_REASON_LABEL,
  FLAG_REASONS,
  formatPostedDate,
  REVIEW_TAG_LABEL,
  similarity,
  sortBySimilarity,
  UGC_STATUS_LABEL,
  type FlagReason,
  type Review,
  type UserPhoto,
} from '@/domain/ugc';
import { sizeFromWeight, type DogProfile } from '@/domain/types';
import { useApp } from '@/state/AppContext';
import { Button, Card, Chip, Icon, IconButton, Section, Tag } from './components';
import { dogInfoText } from './DogInfoPicker';
import { errorMessage } from './errors';
import { OtpLogin } from './OtpLogin';
import { colors, radius, space, type } from './theme';

export type UgcTarget = { kind: 'review'; item: Review } | { kind: 'photo'; item: UserPhoto };

/**
 * 施設詳細の「みんなの口コミ・犬の写真」。
 * 投稿は利用者の感想で、施設の確認情報（室内同伴・冷房・犬の条件）の判定には使わない。
 */
export function UgcSection({ placeId, canPost }: { placeId: string; canPost: boolean }) {
  const { backend, isDemo, profile } = useApp();
  const mineDog = myDog(profile);
  const hasMyDog = !!(mineDog.size || mineDog.breed);
  const [order, setOrder] = useState<'similar' | 'new'>('similar');
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [photos, setPhotos] = useState<UserPhoto[] | null>(null);
  const [error, setError] = useState<RepoError | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [viewer, setViewer] = useState<UserPhoto | null>(null);
  const [action, setAction] = useState<UgcTarget | null>(null);
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

  const sortedReviews = hasMyDog && order === 'similar' ? sortBySimilarity(reviews ?? [], mineDog) : reviews ?? [];
  const visibleReviews = showAll ? sortedReviews : sortedReviews.slice(0, 3);
  const sortedPhotos = hasMyDog ? sortBySimilarity(photos ?? [], mineDog) : photos ?? [];

  return (
    <>
      <Section title={`みんなの犬の写真${photos?.length ? `（${photos.length}）` : ''}`} icon="camera-outline">
        {photos === null && !error ? <Text style={type.small}>読み込み中…</Text> : null}
        {photos && photos.length === 0 ? (
          <View style={styles.emptyBox}>
            <Icon name="images-outline" size={22} color={colors.textSubtle} />
            <Text style={[type.small, { flex: 1 }]}>まだ写真はありません。ここで過ごした犬の写真を投稿できます。</Text>
          </View>
        ) : null}
        {photos && photos.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
            {sortedPhotos.slice(0, 8).map((p) => (
              <PhotoThumb key={p.id} photo={p} size={132} onPress={() => setViewer(p)} similar={hasMyDog && similarity(p, mineDog) > 0} />
            ))}
          </ScrollView>
        ) : null}
        {photos && photos.length > 0 ? (
          <Button label={`犬の写真をすべて見る（${photos.length}枚）`} icon="grid-outline" variant="ghost" onPress={() => router.push({ pathname: '/gallery/[placeId]', params: { placeId } })} />
        ) : null}
        <Button
          label="犬の写真を投稿する"
          icon="camera-outline"
          variant="secondary"
          onPress={canPost ? () => router.push({ pathname: '/photo/[placeId]', params: { placeId } }) : undefined}
          disabledReason={!canPost ? '最新の掲載情報を確認できるときに投稿できます' : undefined}
        />
      </Section>

      <Section title={`みんなの口コミ${reviews?.length ? `（${reviews.length}）` : ''}`} icon="chatbubbles-outline" subtitle="利用者の感想です。室内同伴・冷房などの判定は運営の確認情報によるもので、口コミでは変わりません。">
        {error ? (
          <View style={{ gap: space.sm }}>
            <Text style={{ color: colors.bad }}>{errorMessage(error, '口コミ・写真を読み込めませんでした。')}</Text>
            <Button label="再試行" variant="secondary" onPress={reload} />
          </View>
        ) : null}
        {reviews && reviews.length === 0 ? (
          <View style={styles.emptyBox}>
            <Icon name="chatbubble-ellipses-outline" size={22} color={colors.textSubtle} />
            <Text style={[type.small, { flex: 1 }]}>まだ口コミはありません。最初の口コミを書いてみませんか。</Text>
          </View>
        ) : null}
        {hasMyDog && reviews && reviews.length > 1 ? (
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Chip label="うちの子に近い順" icon="paw-outline" selected={order === 'similar'} onPress={() => setOrder('similar')} />
            <Chip label="新しい順" selected={order === 'new'} onPress={() => setOrder('new')} />
          </View>
        ) : null}
        {visibleReviews.map((r) => (
          <ReviewItem key={r.id} review={r} similar={hasMyDog ? similarity(r, mineDog) : 0} onMenu={() => setAction({ kind: 'review', item: r })} />
        ))}
        {reviews && reviews.length > 3 && !showAll ? (
          <Button label={`口コミをすべて見る（${reviews.length}件）`} variant="ghost" onPress={() => setShowAll(true)} />
        ) : null}
        <Button
          label="口コミを書く"
          icon="create-outline"
          onPress={canPost ? () => router.push({ pathname: '/review/[placeId]', params: { placeId } }) : undefined}
          disabledReason={!canPost ? '最新の掲載情報を確認できるときに書けます' : undefined}
        />
        {isDemo ? <Text style={type.caption}>デモの口コミは架空のものです。投稿した口コミ・写真はこの端末だけに保存されます。</Text> : null}
      </Section>

      <PhotoViewer
        photo={viewer}
        onClose={() => setViewer(null)}
        onMenu={(p) => {
          setViewer(null);
          setAction({ kind: 'photo', item: p });
        }}
      />
      <UgcActionSheet
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

/** うちの子の大きさ・犬種（似た投稿を探す基準） */
export function myDog(profile: DogProfile | null) {
  return { size: sizeFromWeight(profile?.weightKg ?? null), breed: profile?.breed ?? null };
}

/** 写真のサムネイル。犬の大きさ・犬種と「うちの子に近い」印を重ねる */
export function PhotoThumb({ photo: p, size, onPress, similar }: { photo: UserPhoto; size: number; onPress: () => void; similar?: boolean }) {
  const info = dogInfoText(p.dogSize, p.dogBreed);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="imagebutton"
      accessibilityLabel={`犬の写真${info ? `（${info}）` : ''}${p.caption ? `：${p.caption}` : ''}。タップで拡大`}
      style={({ pressed }) => [pressed && { opacity: 0.85 }]}
    >
      <Image source={{ uri: p.url }} style={[styles.thumb, { width: size, height: size }]} resizeMode="cover" />
      {p.mine && p.status !== 'approved' ? <Text style={styles.statusPill}>{p.status === 'pending' ? '確認待ち' : '非表示'}</Text> : null}
      {similar ? (
        <View style={styles.similarPill}>
          <Icon name="paw" size={10} color={colors.white} />
          <Text style={styles.similarText}>うちの子に近い</Text>
        </View>
      ) : null}
      {info ? (
        <Text style={styles.dogPill} numberOfLines={1}>
          {info}
        </Text>
      ) : null}
    </Pressable>
  );
}

function ReviewItem({ review: r, onMenu, similar }: { review: Review; onMenu: () => void; similar: number }) {
  const info = dogInfoText(r.dogSize, r.dogBreed);
  return (
    <Card style={{ gap: space.sm, padding: space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{r.nickname.replace(/^デモ：/, '').slice(0, 1)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={type.label}>
            {r.nickname}
            {r.mine ? '（あなた）' : ''}
          </Text>
          <Text style={type.caption}>
            {r.publishedAt ? `${formatPostedDate(r.publishedAt)} 投稿` : '未公開'}
            {r.visitedOn ? `・${r.visitedOn.replaceAll('-', '/')} 訪問` : ''}
          </Text>
        </View>
        <IconButton
          icon={r.mine ? 'trash-outline' : 'ellipsis-horizontal'}
          label={r.mine ? '自分の口コミの操作（削除）' : 'この口コミを通報・投稿者をブロック'}
          onPress={onMenu}
          background={colors.surfaceAlt}
          color={colors.textMuted}
          size={34}
        />
      </View>
      {r.mine && r.status !== 'approved' ? <Text style={styles.notice}>{UGC_STATUS_LABEL[r.status]}</Text> : null}
      {info ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <Icon name="paw-outline" size={14} color={colors.textMuted} />
          <Text style={type.small}>{info}と来店</Text>
          {similar >= 2 ? <Tag label="うちの子と同じ犬種" tone="accent" /> : similar === 1 ? <Tag label="うちの子と同じ大きさ" tone="accent" /> : null}
        </View>
      ) : null}
      <Text style={type.body}>{r.body}</Text>
      {r.tags.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {r.tags.map((t) => (
            <Tag key={t} label={REVIEW_TAG_LABEL[t]} tone="primary" />
          ))}
        </View>
      ) : null}
    </Card>
  );
}

export function PhotoViewer({ photo, onClose, onMenu }: { photo: UserPhoto | null; onClose: () => void; onMenu: (p: UserPhoto) => void }) {
  return (
    <Modal visible={!!photo} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.viewerBackdrop}>
        {photo ? (
          <View style={{ gap: space.md, width: '100%', maxWidth: 560 }}>
            <Image source={{ uri: photo.url }} style={styles.viewerImg} resizeMode="contain" accessibilityLabel="犬の写真（拡大）" />
            {dogInfoText(photo.dogSize, photo.dogBreed) ? <Text style={[type.label, { color: '#fff' }]}>{dogInfoText(photo.dogSize, photo.dogBreed)}</Text> : null}
            {photo.caption ? <Text style={[type.body, { color: '#fff' }]}>{photo.caption}</Text> : null}
            <Text style={[type.small, { color: '#E5ECEA' }]}>
              {photo.publishedAt ? `${formatPostedDate(photo.publishedAt)} 投稿` : UGC_STATUS_LABEL[photo.status]}
              {photo.mine ? '・あなたの写真' : ''}
            </Text>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Button label={photo.mine ? '削除する' : '通報・ブロック'} icon={photo.mine ? 'trash-outline' : 'flag-outline'} variant="outline" onPress={() => onMenu(photo)} style={{ flex: 1 }} />
              <Button label="閉じる" onPress={onClose} style={{ flex: 1 }} />
            </View>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

export function UgcActionSheet({ target, onClose, onDone }: { target: UgcTarget | null; onClose: () => void; onDone: () => void }) {
  const { backend, auth } = useApp();
  const [reason, setReason] = useState<FlagReason | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [blocking, setBlocking] = useState(false);

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

  const block = async () => {
    setBlocking(true);
    setMsg(null);
    try {
      await backend.ugc.blockAuthor(target.kind, target.item.id);
      setDone('この投稿者の口コミ・写真は、今後あなたには表示されません。相手に知らされることはありません。解除は「マイページ」→「アカウント」からできます。');
    } catch (e) {
      setMsg(errorMessage(e, 'ブロックできませんでした。'));
    } finally {
      setBlocking(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={close}>
      <View style={styles.sheetBackdrop}>
        <ScrollView style={styles.sheet} contentContainerStyle={{ padding: space.lg, gap: space.md }} keyboardShouldPersistTaps="handled">
          <Text style={type.title} accessibilityRole="header">
            {mine ? `自分の${label}を削除` : `${label}を通報・ブロック`}
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
              <Text style={type.body}>{mine ? '削除' : '通報・ブロック'}にはメールでの確認が必要です。</Text>
              <OtpLogin />
              <Button label="やめる" variant="secondary" onPress={close} />
            </>
          ) : mine ? (
            <>
              <Text style={type.body}>この{label}を削除します。元に戻せません。</Text>
              <Button label="削除する" icon="trash-outline" variant="danger" onPress={run} loading={busy} />
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
              <Button label="通報する" icon="flag-outline" onPress={run} loading={busy} disabled={!reason} disabledReason={!reason ? '理由を選んでください' : undefined} />
              <View style={styles.blockBox}>
                <Text style={type.label}>この投稿者をブロック</Text>
                <Text style={type.caption}>この人の口コミ・写真を、今後あなたに表示しないようにします。相手には知らされません。</Text>
                <Button label="ブロックする" icon="ban-outline" variant="danger" onPress={block} loading={blocking} />
              </View>
              <Button label="やめる" variant="ghost" onPress={close} />
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
  dogPill: { position: 'absolute', left: 6, right: 6, bottom: 6, backgroundColor: 'rgba(17,35,31,0.72)', color: colors.white, fontSize: 11, fontWeight: '700', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
  similarPill: { position: 'absolute', right: 6, top: 6, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.accent, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 },
  similarText: { color: colors.white, fontSize: 10.5, fontWeight: '800' },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 15, fontWeight: '800', color: '#8A4A12' },
  emptyBox: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: radius.md, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.borderStrong },
  blockBox: { gap: 6, padding: space.md, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, marginTop: space.sm },
  notice: { ...type.small, color: colors.warn, backgroundColor: colors.warnBg, padding: 6, borderRadius: radius.sm },
  viewerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.88)', alignItems: 'center', justifyContent: 'center', padding: space.lg },
  viewerImg: { width: '100%', aspectRatio: 1, borderRadius: radius.md },
  sheetBackdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, maxHeight: '85%' },
});
