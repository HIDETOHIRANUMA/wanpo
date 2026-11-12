// AsyncStorage はネイティブモジュールのため、テストでは公式のモックを使う
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
