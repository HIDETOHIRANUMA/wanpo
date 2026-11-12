import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * app.json は環境変数を読めないため app.config.ts を使う。
 * 秘密鍵（Supabase の secret / service_role）はここにもクライアントにも入れない。
 * GOOGLE_MAPS_ANDROID_API_KEY はネイティブ設定に埋め込まれる「制限付き」キー（README 参照）。
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const androidMapsKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY ?? '';
  const iosBundleId = process.env.IOS_BUNDLE_IDENTIFIER ?? 'com.example.inutosuzumeru';
  const androidPackage = process.env.ANDROID_PACKAGE ?? 'com.example.inutosuzumeru';
  return {
    ...config,
    name: '犬と涼める',
    slug: 'inu-to-suzumeru',
    scheme: 'inutosuzumeru',
    version: '0.1.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    backgroundColor: '#F7FAF8',
    ios: {
      supportsTablet: false,
      bundleIdentifier: iosBundleId,
      infoPlist: { ITSAppUsesNonExemptEncryption: false },
    },
    android: {
      package: androidPackage,
      adaptiveIcon: {
        backgroundColor: '#E8F5F2',
        foregroundImage: './assets/android-icon-foreground.png',
        backgroundImage: './assets/android-icon-background.png',
        monochromeImage: './assets/android-icon-monochrome.png',
      },
      // 利用時の位置情報のみ。バックグラウンド位置情報は要求しない
      blockedPermissions: ['android.permission.ACCESS_BACKGROUND_LOCATION'],
      predictiveBackGestureEnabled: false,
    },
    web: { favicon: './assets/favicon.png' },
    plugins: [
      'expo-router',
      [
        'expo-location',
        {
          locationWhenInUsePermission:
            '「現在地から探す」を押したときだけ、近くの休憩先を距離順に並べるために現在地を使います。位置情報は保存・送信しません。',
          isIosBackgroundLocationEnabled: false,
          isAndroidBackgroundLocationEnabled: false,
        },
      ],
      ['react-native-maps', androidMapsKey ? { androidGoogleMapsApiKey: androidMapsKey } : {}],
    ],
    experiments: { typedRoutes: false },
    extra: {
      // 開発ビルドで Android の地図キーが設定済みか（未設定なら地図の代わりに説明と一覧を表示）
      androidMapsConfigured: androidMapsKey.length > 0,
    },
  };
};
