import { decodeCreatedRoute, decodePhotos, decodeStops } from '@/api/decode';
import { ApiError } from '@/api/types';

function wireStop(overrides: Record<string, unknown> = {}) {
  return {
    id: 'stp_1001',
    name: 'North Cafe',
    address: '12 North Rd',
    phone: '+44 20',
    packages_max: 5,
    ...overrides,
  };
}

describe('stop decoding', () => {
  it.each([
    [5, 5],
    ['7', 7],
    [null, null],
    [undefined, null],
    [0, null],
    [-2, null],
    [2.5, null],
    ['2.5', null],
    ['', null],
    ['  ', null],
    ['oops', null],
    [Number.POSITIVE_INFINITY, null],
    [true, null],
    ['99', 99],
    [120, 120],
  ])('normalizes packages_max %p to %p', (value, expected) => {
    expect(decodeStops({ items: [wireStop({ packages_max: value })] })).toEqual([
      {
        id: 'stp_1001',
        name: 'North Cafe',
        address: '12 North Rd',
        phone: '+44 20',
        packagesMax: expected,
      },
    ]);
  });
  it.each([{ id: '' }, { id: 123 }, { name: null }, { name: '  ' }, { address: undefined }])(
    'rejects malformed required stop fields %p',
    (fields) => {
      expect(() => decodeStops({ items: [wireStop(fields)] })).toThrow(ApiError);
    }
  );
  it('uses empty phone when the optional contact is absent', () => {
    expect(decodeStops({ items: [wireStop({ phone: null })] })[0]?.phone).toBe('');
  });
  it('treats null items as an empty list', () => {
    expect(decodeStops({ items: null })).toEqual([]);
  });
  it.each([null, [], {}, { items: {} }, { items: [null] }])(
    'rejects unexpected list shape %p',
    (value) => {
      expect(() => decodeStops(value)).toThrow(ApiError);
    }
  );
});

describe('photo decoding', () => {
  it('omits invalid URLs while keeping usable HTTP and HTTPS photos', () => {
    expect(
      decodePhotos({
        items: [
          { id: 'p1', url: 'https://picsum.photos/seed/1/400/250', tag: 'entrance' },
          { id: 'p2', url: null, tag: 'parking' },
          { id: 'p3', url: 'javascript:alert(1)', tag: 'back_door' },
          { id: 'p4', url: 'http://images.example.org/a.jpg', tag: 'parking' },
          { id: 'p5', url: 'https://', tag: 'entrance' },
          { id: 'p6', url: 'https:// bad/a', tag: 'entrance' },
          { id: '', url: 'https://example.org/a', tag: 'entrance' },
        ],
      })
    ).toEqual([
      { id: 'p1', url: 'https://picsum.photos/seed/1/400/250', tag: 'entrance' },
      { id: 'p4', url: 'http://images.example.org/a.jpg', tag: 'parking' },
    ]);
  });
  it('accepts null photo items', () => {
    expect(decodePhotos({ items: null })).toEqual([]);
  });
});

describe('created route decoding', () => {
  it('returns the exact normalized confirmed route', () => {
    expect(
      decodeCreatedRoute({
        id: 'rt_2000',
        status: 'draft',
        stops: [{ stop_id: 'stp_1001', packages: 2, instructions: 'Side door' }],
      })
    ).toEqual({
      id: 'rt_2000',
      status: 'draft',
      stops: [{ stop_id: 'stp_1001', packages: 2, instructions: 'Side door' }],
    });
  });
  it.each([
    null,
    {},
    { id: 'rt_2000', status: 'sent', stops: [] },
    { id: 'rt_2000', status: 'draft', stops: [] },
    { id: 'rt_2000', status: 'draft', stops: [{ stop_id: 'x', packages: '2', instructions: '' }] },
  ])('rejects an uncertain successful-response shape %p', async (value) => {
    await expect(Promise.resolve().then(() => decodeCreatedRoute(value))).rejects.toMatchObject({
      kind: 'invalid-response',
      outcome: 'uncertain',
    });
  });
});

it.each([
  'https://[broken/a',
  'https://:123/a',
  'https://example.org:bad/a',
  'https://example.org\\evil/a',
])('omits a malformed photo authority %s without relying on DOM URL', (url) => {
  expect(decodePhotos({ items: [{ id: 'p1', url, tag: 'entrance' }] })).toEqual([]);
});

it.each([
  'http://999.999.999.999/a.jpg',
  'http://127.0.0.999/a.jpg',
  'https://256.0.0.1/a.jpg',
  'https://127.0.0/a.jpg',
  'https://127.0.0.1.2/a.jpg',
  'https://127.0.0.09/a.jpg',
])('omits a photo whose numeric IPv4 authority is invalid: %s', (url) => {
  expect(decodePhotos({ items: [{ id: 'p1', url, tag: 'entrance' }] })).toEqual([]);
});

it.each([
  'http://127.0.0.1/a.jpg',
  'https://0.0.0.0/a.jpg',
  'https://255.255.255.255:8443/a.jpg',
  'https://images.example.org/a.jpg',
])('retains a photo with a valid IPv4 or hostname authority: %s', (url) => {
  expect(decodePhotos({ items: [{ id: 'p1', url, tag: 'entrance' }] })).toEqual([
    { id: 'p1', url, tag: 'entrance' },
  ]);
});
