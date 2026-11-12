import { Stack } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { CARRY_METHOD_LABEL, DOG_SEX_LABEL, DOG_SIZE_LABEL } from '@/domain/labels';
import { EMPTY_DOG_PROFILE, sizeFromWeight, type DogCard, type DogProfile, type DogSex, type Tri } from '@/domain/types';
import { toJst } from '@/domain/hours';
import { useApp } from '@/state/AppContext';
import { Button, Card, Icon, Loading, Notice, Section, Segmented, TextField } from '@/ui/components';
import { colors, radius, shadow, space, type } from '@/ui/theme';

/** 月齢・年齢の表示（生まれた年月から） */
function ageText(birthMonth: string | null, now: Date): string | null {
  if (!birthMonth) return null;
  const [y, m] = birthMonth.split('-').map(Number);
  const t = toJst(now).date;
  const months = (Number(t.slice(0, 4)) - y) * 12 + (Number(t.slice(5, 7)) - m);
  if (months < 0) return null;
  return months < 12 ? `${months}か月` : `${Math.floor(months / 12)}歳${months % 12 ? `${months % 12}か月` : ''}`;
}

/** 接種から1年以上たっていれば注意 */
function vaccineText(date: string | null, now: Date): { text: string; stale: boolean } | null {
  if (!date) return null;
  const days = (now.getTime() - Date.parse(`${date}T00:00:00+09:00`)) / 86_400_000;
  return { text: date.replace(/-/g, '/'), stale: days > 365 };
}

/**
 * うちの子カード：入店時にお店の方へ画面を見せるためのカード。
 * 端末内だけに保存し、送信しない。
 */
export default function DogCardScreen() {
  const { ready, profile } = useApp();
  const [editing, setEditing] = useState(false);
  if (!ready) return <Loading />;
  const p = profile ?? EMPTY_DOG_PROFILE;
  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: space.lg, paddingBottom: 48, gap: space.md }} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: 'うちの子カード' }} />
      {editing ? <CardForm profile={p} onDone={() => setEditing(false)} /> : <CardView profile={p} onEdit={() => setEditing(true)} />}
    </ScrollView>
  );
}

function CardView({ profile: p, onEdit }: { profile: DogProfile; onEdit: () => void }) {
  const now = new Date();
  const c = p.card;
  const size = sizeFromWeight(p.weightKg);
  const age = ageText(c.birthMonth, now);
  const rabies = vaccineText(c.rabiesVaccinatedOn, now);
  const combo = vaccineText(c.comboVaccinatedOn, now);
  const empty = !p.name && !p.breed && p.weightKg === null && !c.rabiesVaccinatedOn && !c.comboVaccinatedOn;
  return (
    <>
      <Text style={type.small}>お店に入るときに、この画面をお店の方へ見せてください。情報はこの端末だけに保存され、送信されません。</Text>
      <View style={styles.card} accessible accessibilityLabel="うちの子カード">
        <View style={styles.cardHead}>
          <View style={styles.avatar}>
            <Icon name="paw" size={34} color={colors.white} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardOver}>DOG CARD　うちの子カード</Text>
            <Text style={styles.name}>{p.name ?? '（名前未登録）'}</Text>
            <Text style={styles.sub}>{[p.breed, size ? DOG_SIZE_LABEL[size] : null, c.sex ? DOG_SEX_LABEL[c.sex] : null, age].filter(Boolean).join('・') || '犬種・大きさは未登録'}</Text>
          </View>
        </View>
        <View style={styles.grid}>
          <Cell label="体重" value={p.weightKg !== null ? `${p.weightKg}kg` : '未登録'} />
          <Cell label="去勢・避妊" value={triText(c.neutered, '済み', 'していない')} />
          <Cell label="狂犬病予防注射" value={rabies?.text ?? '未登録'} warn={rabies?.stale} />
          <Cell label="混合ワクチン" value={combo?.text ?? '未登録'} warn={combo?.stale} />
        </View>
        {p.carryMethods.length ? (
          <View style={styles.line}>
            <Text style={styles.lineLabel}>同伴方法</Text>
            <Text style={styles.lineValue}>{p.carryMethods.map((m) => CARRY_METHOD_LABEL[m]).join('・')}で対応できます</Text>
          </View>
        ) : null}
        {c.personality ? (
          <View style={styles.line}>
            <Text style={styles.lineLabel}>性格</Text>
            <Text style={styles.lineValue}>{c.personality}</Text>
          </View>
        ) : null}
        {c.noteForStaff ? (
          <View style={[styles.line, styles.note]}>
            <Text style={[styles.lineLabel, { color: colors.primaryInk }]}>お店の方へ</Text>
            <Text style={[styles.lineValue, { fontWeight: '700' }]}>{c.noteForStaff}</Text>
          </View>
        ) : null}
      </View>
      {(rabies?.stale || combo?.stale) ? <Notice tone="warn" title="接種から1年以上たっている項目があります" body="お店によっては最新の接種証明を求められます。証明書もあわせてお持ちください。" /> : null}
      {empty ? <Notice tone="info" title="まだ登録されていません" body="「カードを編集する」から、名前・ワクチン接種日などを登録できます。" /> : null}
      <Text style={type.caption}>このカードは飼い主さんの自己申告です。接種の証明が必要なお店では、証明書の原本や写しをお見せください。</Text>
      <Button label="カードを編集する" icon="create-outline" variant="secondary" size="lg" onPress={onEdit} />
    </>
  );
}

function triText(t: Tri, yes: string, no: string): string {
  return t === 'yes' ? yes : t === 'no' ? no : '未登録';
}

function Cell({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <View style={styles.cell}>
      <Text style={styles.cellLabel}>{label}</Text>
      <Text style={[styles.cellValue, warn && { color: colors.warn }]}>
        {value}
        {warn ? '（1年以上前）' : ''}
      </Text>
    </View>
  );
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function CardForm({ profile, onDone }: { profile: DogProfile; onDone: () => void }) {
  const { saveProfile } = useApp();
  const c = profile.card;
  const [sex, setSex] = useState<DogSex | 'unknown'>(c.sex ?? 'unknown');
  const [birth, setBirth] = useState(c.birthMonth ?? '');
  const [neutered, setNeutered] = useState<Tri>(c.neutered);
  const [rabies, setRabies] = useState(c.rabiesVaccinatedOn ?? '');
  const [combo, setCombo] = useState(c.comboVaccinatedOn ?? '');
  const [personality, setPersonality] = useState(c.personality ?? '');
  const [note, setNote] = useState(c.noteForStaff ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const norm = (s: string) => s.trim().replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0)).replace(/[/.]/g, '-');
  const birthBad = birth.trim() !== '' && !/^\d{4}-(0[1-9]|1[0-2])$/.test(norm(birth));
  const rabiesBad = rabies.trim() !== '' && !DATE_RE.test(norm(rabies));
  const comboBad = combo.trim() !== '' && !DATE_RE.test(norm(combo));
  const invalid = birthBad || rabiesBad || comboBad;

  const save = async () => {
    if (invalid) return;
    setSaving(true);
    setError(null);
    const card: DogCard = {
      sex: sex === 'unknown' ? null : sex,
      birthMonth: birth.trim() ? norm(birth) : null,
      neutered,
      rabiesVaccinatedOn: rabies.trim() ? norm(rabies) : null,
      comboVaccinatedOn: combo.trim() ? norm(combo) : null,
      personality: personality.trim() || null,
      noteForStaff: note.trim() || null,
    };
    try {
      await saveProfile({ ...profile, card });
      onDone();
    } catch {
      setError('保存できませんでした。もう一度お試しください。');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Notice tone="info" icon="lock-closed-outline" title="この端末だけに保存されます" body="名前・体重・犬種・同伴方法は「マイページ」で登録した内容を使います。" />
      <Section title="基本" icon="paw-outline">
        <Card style={{ gap: space.md }}>
          <View style={{ gap: space.xs }}>
            <Text style={type.label}>性別</Text>
            <Segmented
              value={sex}
              onChange={setSex}
              options={[
                { value: 'male', label: 'オス' },
                { value: 'female', label: 'メス' },
                { value: 'unknown', label: '未登録' },
              ]}
            />
          </View>
          <TextField label="生まれた年月" value={birth} onChangeText={setBirth} placeholder="例：2021-04" keyboardType="numbers-and-punctuation" maxLength={7} error={birthBad ? '「2021-04」の形で入力してください' : null} />
          <View style={{ gap: space.xs }}>
            <Text style={type.label}>去勢・避妊</Text>
            <Segmented
              value={neutered}
              onChange={setNeutered}
              options={[
                { value: 'yes', label: '済み' },
                { value: 'no', label: 'していない' },
                { value: 'unknown', label: '未登録' },
              ]}
            />
          </View>
        </Card>
      </Section>
      <Section title="ワクチン" icon="medkit-outline" subtitle="接種日">
        <Card style={{ gap: space.md }}>
          <TextField label="狂犬病予防注射" value={rabies} onChangeText={setRabies} placeholder="例：2026-04-20" keyboardType="numbers-and-punctuation" maxLength={10} error={rabiesBad ? '「2026-04-20」の形で入力してください' : null} />
          <TextField label="混合ワクチン" value={combo} onChangeText={setCombo} placeholder="例：2026-05-10" keyboardType="numbers-and-punctuation" maxLength={10} error={comboBad ? '「2026-05-10」の形で入力してください' : null} />
        </Card>
      </Section>
      <Section title="お店の方へ" icon="chatbubble-ellipses-outline">
        <Card style={{ gap: space.md }}>
          <TextField label="性格・苦手なこと" value={personality} onChangeText={setPersonality} placeholder="例：人が好き。大きな音が苦手" maxLength={100} />
          <TextField label="ひとこと" value={note} onChangeText={setNote} placeholder="例：マナーパンツ着用・吠えたらすぐ外に出ます" maxLength={100} />
        </Card>
      </Section>
      {error ? <Notice tone="bad" title={error} /> : null}
      <Button label="保存してカードを見る" icon="checkmark" size="lg" onPress={save} loading={saving} disabled={invalid} disabledReason={invalid ? '日付の入力を確認してください' : undefined} />
      <Button label="キャンセル" variant="ghost" onPress={onDone} />
    </>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, ...shadow.raised },
  cardHead: { flexDirection: 'row', gap: space.md, alignItems: 'center', backgroundColor: colors.primary, padding: space.lg },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)' },
  cardOver: { fontSize: 11, fontWeight: '800', color: 'rgba(255,255,255,0.85)', letterSpacing: 1 },
  name: { fontSize: 26, lineHeight: 34, fontWeight: '800', color: colors.white },
  sub: { fontSize: 14, color: colors.white, opacity: 0.95, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', padding: space.md, gap: space.sm },
  cell: { width: '48%', flexGrow: 1, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: space.md, gap: 2 },
  cellLabel: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  cellValue: { fontSize: 17, fontWeight: '800', color: colors.text },
  line: { marginHorizontal: space.md, marginBottom: space.sm, gap: 2 },
  note: { backgroundColor: colors.primarySoft, borderRadius: radius.md, padding: space.md, marginBottom: space.md },
  lineLabel: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  lineValue: { fontSize: 16, lineHeight: 24, color: colors.text },
});
