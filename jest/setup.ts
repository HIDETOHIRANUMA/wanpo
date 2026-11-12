// AsyncStorage はネイティブモジュールのため、テストでは公式のモックを使う
jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock のファクトリ内では require を使う
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
