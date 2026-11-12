import React from 'react';
import { Text, View } from 'react-native';
import { DOG_SIZE_LABEL } from '@/domain/labels';
import { DOG_SIZES, type DogSize } from '@/domain/types';
import { DOG_BREED_MAX } from '@/domain/ugc';
import { Chip, TextField } from './components';
import { space, type } from './theme';

/** 口コミ・写真に添える「一緒の犬」の大きさと犬種（任意）。似た犬の投稿を探すのに使う */
export function DogInfoPicker({
  size,
  breed,
  onChange,
}: {
  size: DogSize | null;
  breed: string | null;
  onChange: (v: { dogSize: DogSize | null; dogBreed: string | null }) => void;
}) {
  return (
    <View style={{ gap: space.sm }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {DOG_SIZES.map((s) => (
          <Chip key={s} label={DOG_SIZE_LABEL[s]} selected={size === s} onPress={() => onChange({ dogSize: size === s ? null : s, dogBreed: breed })} />
        ))}
      </View>
      <TextField
        value={breed ?? ''}
        onChangeText={(t) => onChange({ dogSize: size, dogBreed: t.trim() ? t.slice(0, DOG_BREED_MAX) : null })}
        maxLength={DOG_BREED_MAX}
        placeholder="犬種（例：トイプードル、MIX）"
        icon="paw-outline"
        accessibilityLabel="一緒に行った犬の犬種（任意）"
      />
      <Text style={type.caption}>任意です。同じくらいの大きさ・同じ犬種の飼い主さんが、参考にしやすくなります。</Text>
    </View>
  );
}

/** 「小型犬・トイプードル」のような短い表記。情報がなければ null */
export function dogInfoText(size: DogSize | null, breed: string | null): string | null {
  const parts = [size ? DOG_SIZE_LABEL[size] : null, breed].filter(Boolean);
  return parts.length ? parts.join('・') : null;
}
