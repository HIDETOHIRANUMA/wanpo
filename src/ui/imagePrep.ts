import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import type { PreparedImage } from '@/domain/ugc';

/** 長辺の上限（px）と JPEG の品質。容量を抑え、表示に十分な大きさにする */
export const PHOTO_MAX_EDGE = 1280;
const DEMO_MAX_EDGE = 720; // デモは端末内に保存するため小さくする
const JPEG_QUALITY = 0.72;

export type PickResult = { ok: true; image: PreparedImage } | { ok: false; reason: 'cancelled' | 'failed' };

/**
 * 写真を1枚選び、縮小して JPEG に再エンコードする。
 * - 撮影位置などのメタデータ（EXIF）は読み込まない（exif: false）。再エンコードした画像だけを送る
 * - 写真ライブラリの選択画面はOSの機能を使うため、写真全体へのアクセス許可は求めない
 */
export async function pickAndPreparePhoto(opts: { forDemo: boolean }): Promise<PickResult> {
  let picked: ImagePicker.ImagePickerResult;
  try {
    picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      allowsMultipleSelection: false,
      exif: false,
      base64: false,
      quality: 1,
    });
  } catch {
    return { ok: false, reason: 'failed' };
  }
  if (picked.canceled || !picked.assets?.[0]) return { ok: false, reason: 'cancelled' };
  const asset = picked.assets[0];
  try {
    const maxEdge = opts.forDemo ? DEMO_MAX_EDGE : PHOTO_MAX_EDGE;
    const ctx = ImageManipulator.manipulate(asset.uri);
    const w = asset.width || maxEdge;
    const h = asset.height || maxEdge;
    if (Math.max(w, h) > maxEdge) {
      if (w >= h) ctx.resize({ width: maxEdge });
      else ctx.resize({ height: maxEdge });
    }
    const ref = await ctx.renderAsync();
    const saved = await ref.saveAsync({ format: SaveFormat.JPEG, compress: JPEG_QUALITY, base64: true });
    if (!saved.base64) return { ok: false, reason: 'failed' };
    return {
      ok: true,
      image: {
        uri: saved.uri,
        width: saved.width,
        height: saved.height,
        base64: saved.base64,
        dataUri: opts.forDemo ? `data:image/jpeg;base64,${saved.base64}` : undefined,
      },
    };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}
