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
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    backgroundColor: '#F3F6F5',
    ios: {
      supportsTablet: false,
      bundleIdentifier: iosBundleId,
      infoPlist: { ITSAppUsesNonExemptEncryption: false },
      // Apple のプライバシーマニフェスト：トラッキングなし。使う「理由が必要なAPI」は端末内保存（UserDefaults）など
      privacyManifests: {
        NSPrivacyTracking: false,
        NSPrivacyTrackingDomains: [],
        NSPrivacyCollectedDataTypes: [
          { NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeEmailAddress', NSPrivacyCollectedDataTypeLinked: true, NSPrivacyCollectedDataTypeTracking: false, NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'] },
          { NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypePhotosorVideos', NSPrivacyCollectedDataTypeLinked: true, NSPrivacyCollectedDataTypeTracking: false, NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'] },
          { NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeOtherUserContent', NSPrivacyCollectedDataTypeLinked: true, NSPrivacyCollectedDataTypeTracking: false, NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'] },
          { NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeUserID', NSPrivacyCollectedDataTypeLinked: true, NSPrivacyCollectedDataTypeTracking: false, NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'] },
        ],
        NSPrivacyAccessedAPITypes: [
          { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults', NSPrivacyAccessedAPITypeReasons: ['CA92.1'] },
          { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryFileTimestamp', NSPrivacyAccessedAPITypeReasons: ['C617.1'] },
          { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategorySystemBootTime', NSPrivacyAccessedAPITypeReasons: ['35F9.1'] },
          { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryDiskSpace', NSPrivacyAccessedAPITypeReasons: ['E174.1'] },
        ],
      },
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
      // WEB_PREVIEW=1 のときは Web を1ファイルにまとめるため、ルートの分割読み込みを止める（scripts/build-web-preview.mjs）
      process.env.WEB_PREVIEW === '1' ? ['expo-router', { asyncRoutes: false }] : 'expo-router',
      [
        'expo-splash-screen',
        {
          image: './assets/splash-icon.png',
          imageWidth: 180,
          resizeMode: 'contain',
          backgroundColor: '#0B7A70',
        },
      ],
      // アイコン用フォントをアプリに同梱し、起動直後にアイコンが空白になるのを防ぐ
      ['expo-font', { fonts: ['./node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf'] }],
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
      [
        'expo-image-picker',
        {
          // 写真はOSの選択画面から1枚だけ選ぶ。カメラ・マイクは使わない
          photosPermission: '犬の写真を投稿するときに、選んだ写真だけを使います。',
          cameraPermission: false,
          microphonePermission: false,
        },
      ],
    ],
    experiments: { typedRoutes: false },
    extra: {
      // 開発ビルドで Android の地図キーが設定済みか（未設定なら地図の代わりに説明と一覧を表示）
      androidMapsConfigured: androidMapsKey.length > 0,
    },
  };
};
