import { directionsUrl, normalizePhone, validateHttpsUrl } from '../contact';

describe('電話番号', () => {
  test.each([
    ['03-1234-5678', '0312345678'],
    ['090-1234-5678', '09012345678'],
    ['+81-3-1234-5678', '0312345678'],
  ])('%s は有効', (raw, out) => expect(normalizePhone(raw)).toBe(out));
  test.each(['', '123', 'abc-defg', '03-1234-5678; rm', 'tel:0312345678'])('%s は無効', (raw) =>
    expect(normalizePhone(raw)).toBeNull(),
  );
});

describe('URL', () => {
  test('https のみ許可', () => {
    expect(validateHttpsUrl('https://example.com/menu')).toBe('https://example.com/menu');
    expect(validateHttpsUrl('http://example.com')).toBeNull();
    expect(validateHttpsUrl('javascript:alert(1)')).toBeNull();
    expect(validateHttpsUrl('https://user:pass@example.com')).toBeNull();
    expect(validateHttpsUrl('https://example')).toBeNull();
    expect(validateHttpsUrl('https://exa mple.com')).toBeNull();
  });
});

describe('経路リンク', () => {
  test('目的地座標のみを渡す', () => {
    expect(directionsUrl(35.1, 139.2, 'ios')).toBe('https://maps.apple.com/?daddr=35.100000,139.200000');
    expect(directionsUrl(35.1, 139.2, 'android')).toContain('destination=35.100000,139.200000');
  });
});
