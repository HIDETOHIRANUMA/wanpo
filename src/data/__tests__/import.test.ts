import { readFileSync } from 'fs';
import { csvRowToRaw, parseCsv, validatePlace } from '../import/validate';
import { validateReportInput } from '../reportValidation';

const AREAS = ['shinagawa', 'minato', 'shibuya'];
const NOW = new Date('2026-11-11T00:00:00Z');
const template = () => JSON.parse(readFileSync('templates/places.template.json', 'utf8'))[0];

describe('投入データの検証', () => {
  test('テンプレート（JSON・CSV）はそのまま通る', () => {
    expect(validatePlace(template(), 0, AREAS, NOW).errors).toEqual([]);
    const csv = parseCsv(readFileSync('templates/places.template.csv', 'utf8'));
    expect(csv).toHaveLength(1);
    expect(validatePlace(csvRowToRaw(csv[0]), 0, AREAS, NOW).errors).toEqual([]);
  });

  test('必須値・enum・座標・URL・時間の誤りを行と項目つきで報告', () => {
    const t = template();
    const bad = {
      ...t,
      ref: 'row-9',
      name: '',
      category: 'bar',
      lat: 0,
      official_url: 'http://example.com',
      zone: { ...t.zone, scope: 'terrace', indoor_dogs: 'yes', weight_max_inclusive: undefined, carry_methods: ['sling'] },
      business_hours: { mon: ['25:00-26:00'], xyz: ['10:00-11:00'] },
      verifications: [{ field: 'indoor_dogs', method: 'phone', verified_at: '2026-11-01' }],
    };
    const { value, errors } = validatePlace(bad, 8, AREAS, NOW);
    expect(value).toBeNull();
    const fields = errors.map((e) => e.field);
    expect(errors.every((e) => e.ref === 'row-9')).toBe(true);
    expect(fields).toEqual(
      expect.arrayContaining([
        'name',
        'category',
        'lat/lng',
        'official_url',
        'zone.indoor_dogs',
        'zone.weight_max_inclusive',
        'zone.carry_methods',
        'business_hours.mon',
        'business_hours',
        'verifications',
      ]),
    );
  });

  test('未入力の条件は unknown として取り込む（制限なしにしない）', () => {
    const { value } = validatePlace(
      { name: 'x', category: 'cafe', address: 'a', area_id: 'minato', lat: 35.6, lng: 139.7, zone: { name: '店内' } },
      0,
      AREAS,
      NOW,
    );
    expect(value!.zone).toMatchObject({ indoor_dogs: 'unknown', air_conditioning: 'unknown', weight_limit_kind: 'unknown', carry_status: 'unknown', certificate: 'unknown' });
    expect(value!.place).toMatchObject({ publication_status: 'draft', water: 'unknown', order_required: 'unknown' });
  });

  test('デモ施設を本番に公開しようとすると拒否', () => {
    const { errors } = validatePlace({ ...template(), name: 'デモ・テスト', publication_status: 'published' }, 0, AREAS, NOW);
    expect(errors.some((e) => e.field === 'name')).toBe(true);
  });

  test('未登録エリアは拒否', () => {
    expect(validatePlace({ ...template(), area_id: 'setagaya' }, 0, AREAS, NOW).errors[0].field).toBe('area_id');
  });
});

describe('報告の入力検証（クライアント側）', () => {
  const base = { requestId: '0b0b0b0b-0000-4000-8000-000000000001', placeId: 'p', type: 'correction' as const, targetField: 'hours' as const, voteChoice: null, body: '内容', visitedOn: null };
  test('正しい入力', () => expect(validateReportInput(base, NOW)).toEqual([]));
  test('本文なし・長すぎ・未来の訪問日', () => {
    expect(validateReportInput({ ...base, body: ' ' }, NOW)).toContain('body_required');
    expect(validateReportInput({ ...base, body: 'あ'.repeat(1001) }, NOW)).toContain('body_too_long');
    expect(validateReportInput({ ...base, visitedOn: '2026-12-01' }, NOW)).toContain('visitedOn_future');
  });
  test('投票は選択肢が必須、本文は任意', () => {
    const vote = { ...base, type: 'dog_ok_vote' as const, targetField: null, body: '' };
    expect(validateReportInput(vote, NOW)).toContain('voteChoice');
    expect(validateReportInput({ ...vote, voteChoice: 'terrace_only' }, NOW)).toEqual([]);
  });
});
