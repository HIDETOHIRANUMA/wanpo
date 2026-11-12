import { Redirect } from 'expo-router';

/** 存在しないURL（Web プレビューを別のパスで開いた場合など）は「探す」へ戻す */
export default function NotFound() {
  return <Redirect href="/" />;
}
