// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { stillUrl } from '../src/still';

const KEY = 'cs2pk_your_key_here';
const INSPECT = 'steam://rungame/730/76561202255233023/+csgo_econ_action_preview 001807209A0228043004388F85D7F30340950512E67D72';

describe('stillUrl builds the documented URLs', () => {
  it('matches the quickstart <img> URL', () => {
    expect(stillUrl({ id: 'ak47_cu_ak47_cobra_gen', wear: 0.1662, seed: 55, view: 'front', w: 640, h: 400, key: KEY })).toBe(
      'https://inspekt.gg/api/still?id=ak47_cu_ak47_cobra_gen&wear=0.1662&seed=55&view=front&w=640&h=400&key=cs2pk_your_key_here',
    );
  });

  it('matches the inspect-link request, with the link URL-encoded', () => {
    expect(stillUrl({ inspect: INSPECT, view: 'front', bg: 'rarity', w: 640, h: 400, key: KEY })).toBe(
      'https://inspekt.gg/api/still?inspect=steam%3A%2F%2Frungame%2F730%2F76561202255233023%2F%2Bcsgo_econ_action_preview%20001807209A0228043004388F85D7F30340950512E67D72&view=front&bg=rarity&w=640&h=400&key=cs2pk_your_key_here',
    );
  });

  it('matches the five-sticker and Sticker Slab example', () => {
    expect(
      stillUrl({
        id: 'm4a1_cu_m4a1_howling_gen',
        wear: 0.170842,
        seed: 655,
        st: '0:103:0.00,3:7916:0.98:-0.3514:0.08:151.5,6:5952:0.00:0.2242:-0.0444:6,6:7916:0.98:0.0027:0.0179:130.5,6:7916:0.98:-0.0266:0.075:171',
        charm: '37:15.9565:0.4259:14.7431~103',
        view: 'front',
        w: 640,
        h: 400,
        key: KEY,
      }),
    ).toBe(
      'https://inspekt.gg/api/still?id=m4a1_cu_m4a1_howling_gen&wear=0.170842&seed=655&st=0:103:0.00,3:7916:0.98:-0.3514:0.08:151.5,6:5952:0.00:0.2242:-0.0444:6,6:7916:0.98:0.0027:0.0179:130.5,6:7916:0.98:-0.0266:0.075:171&charm=37:15.9565:0.4259:14.7431~103&view=front&w=640&h=400&key=cs2pk_your_key_here',
    );
  });

  it('matches the charm examples: offsets with a seed, and a seed alone', () => {
    expect(stillUrl({ id: 'ak47_cu_ak47_cobra_gen', wear: 0.24, seed: 661, charm: '73:-9.874:0.718:-1.735@40000', view: 'front', w: 640, h: 400, key: KEY })).toBe(
      'https://inspekt.gg/api/still?id=ak47_cu_ak47_cobra_gen&wear=0.24&seed=661&charm=73:-9.874:0.718:-1.735@40000&view=front&w=640&h=400&key=cs2pk_your_key_here',
    );
    expect(stillUrl({ id: 'deagle_cu_deag_printstream_gen', wear: 0.03, seed: 100, charm: '60@75000', view: 'front', w: 640, h: 400, key: KEY })).toBe(
      'https://inspekt.gg/api/still?id=deagle_cu_deag_printstream_gen&wear=0.03&seed=100&charm=60@75000&view=front&w=640&h=400&key=cs2pk_your_key_here',
    );
  });

  it('matches the standalone sticker and standalone charm examples', () => {
    expect(stillUrl({ sticker: 9362, bg: 'transparent', w: 512, h: 384, key: KEY })).toBe(
      'https://inspekt.gg/api/still?sticker=9362&bg=transparent&w=512&h=384&key=cs2pk_your_key_here',
    );
    expect(stillUrl({ charm: '60@75000', w: 640, h: 400, key: KEY })).toBe('https://inspekt.gg/api/still?charm=60@75000&w=640&h=400&key=cs2pk_your_key_here');
  });

  it('writes parameters in the docs table order and omits the ones not given', () => {
    const url = stillUrl({ key: KEY, wait: 0, h: 400, w: 640, light: 'icon', bg: 'violet', view: 'top', name: 'Old Faithful', stattrak: 0, id: 'x1', seed: 0, wear: 0 });
    expect(url).toBe('https://inspekt.gg/api/still?id=x1&wear=0&seed=0&stattrak=0&name=Old%20Faithful&view=top&bg=violet&light=icon&w=640&h=400&wait=0&key=cs2pk_your_key_here');
  });

  it('accepts the bounds themselves', () => {
    expect(() => stillUrl({ id: 'a', wear: 1, seed: 1000, stattrak: 999999, w: 160, h: 2560, wait: 1, key: 'abcd' })).not.toThrow();
    expect(() => stillUrl({ id: 'a', name: 'x'.repeat(20), bg: 'rarity-contraband', key: KEY })).not.toThrow();
  });

  it('keeps an empty placement field in st, as in the docs', () => {
    expect(stillUrl({ id: 'a', st: '3:1044:0.12:::90', key: KEY })).toContain('st=3:1044:0.12:::90&');
  });

  it('sends st and charm as given, encoding what a query value cannot carry', () => {
    const st = '0:1044:0.1 &key=x#';
    const charm = '60@7 ~103&w=9';
    const url = stillUrl({ id: 'a', st, charm, key: KEY });
    expect(url).toContain('st=0:1044:0.1%20%26key%3Dx%23&charm=60@7%20~103%26w%3D9&');
    const q = new URL(url).searchParams;
    expect([q.get('st'), q.get('charm'), q.getAll('key'), q.getAll('w')]).toEqual([st, charm, [KEY], []]);
  });

  it('counts a name tag as the server does: trimmed, in UTF-16 units', () => {
    expect(() => stillUrl({ id: 'a', name: `  ${'x'.repeat(20)}  `, key: KEY })).not.toThrow();
    expect(() => stillUrl({ id: 'a', name: '\u{1F525}'.repeat(10), key: KEY })).not.toThrow();
    expect(() => stillUrl({ id: 'a', name: '\u{1F525}'.repeat(11), key: KEY })).toThrow(/name must be at most 20 characters/);
  });
});

describe('stillUrl rejects values outside the documented bounds', () => {
  const base = { id: 'ak47_cu_ak47_cobra_gen', key: KEY };
  const cases: Array<[string, Record<string, unknown>, RegExp]> = [
    ['wear above 1', { wear: 1.5 }, /wear must be a number from 0 to 1/],
    ['wear below 0', { wear: -0.01 }, /wear must be/],
    ['wear that is not a number', { wear: Number.NaN }, /wear must be/],
    ['seed above 1000', { seed: 1001 }, /seed must be a whole number from 0 to 1000/],
    ['seed with a fraction', { seed: 1.5 }, /seed must be/],
    ['stattrak above 999999', { stattrak: 1000000 }, /stattrak must be a whole number from 0 to 999999/],
    ['stattrak below 0', { stattrak: -1 }, /stattrak must be/],
    ['w below 160', { w: 159 }, /w must be a whole number from 160 to 2560/],
    ['w above 2560', { w: 2561 }, /w must be/],
    ['h below 160', { h: 100 }, /h must be a whole number from 160 to 2560/],
    ['view outside the set', { view: 'side' }, /view must be one of hero, front, back, top/],
    ['bg outside the list', { bg: 'red' }, /bg must be one of/],
    ['light outside the set', { light: 'dark' }, /light must be one of icon, inspect/],
    ['wait other than 0 or 1', { wait: 2 }, /wait must be one of 0, 1/],
    ['name over 20 characters', { name: 'x'.repeat(21) }, /name must be at most 20 characters/],
    ['name with a control character', { name: 'a\nb' }, /name must be/],
    ['id with a slash', { id: 'ak47/redline' }, /id must be a catalog id/],
    ['id that starts with a dot', { id: '.hidden' }, /id must be/],
    ['sticker index 0', { id: undefined, sticker: 0 }, /sticker must be a whole number from 1 to 999999/],
    ['key too short', { key: 'abc' }, /key must be 4 to 64 characters/],
    ['key with a space', { key: 'cs2pk bad' }, /key must be/],
    ['secret key', { key: 'cs2sk_abcdef' }, /key must be the publishable key or a token/],
  ];

  it.each(cases)('%s', (_label, patch, message) => {
    expect(() => stillUrl({ ...base, ...patch } as never)).toThrow(RangeError);
    expect(() => stillUrl({ ...base, ...patch } as never)).toThrow(message);
  });

  it('requires a key', () => {
    expect(() => stillUrl({ id: 'a' } as never)).toThrow(TypeError);
  });

  it('requires one of inspect, id, sticker or charm', () => {
    expect(() => stillUrl({ key: KEY })).toThrow(/pass inspect, id, sticker or charm/);
  });
});
